package com.syncstream.backend.services;

import com.syncstream.backend.websocket.TerminalSessionManager;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Map;
import java.util.concurrent.*;

@Service
public class TerminalExecutionService {

  private static final Logger logger =
    LoggerFactory.getLogger(TerminalExecutionService.class);

  private final TerminalSessionManager sessionManager;
  private final CommandSecurityFilter securityFilter;

  private final ExecutorService executor =
    Executors.newCachedThreadPool();

  private final Map<String, Process> runningProcesses =
    new ConcurrentHashMap<>();

  /** Max wall-clock time allowed for a single code execution run. */
  private static final int EXECUTION_TIMEOUT_SECONDS = 30;

  /** Max bytes of code accepted from a run-code payload. */
  private static final int MAX_CODE_BYTES = 100 * 1024; // 100 KB

  private static final String RUNNER_CONTAINER =
    "syncstream-runner";

  public TerminalExecutionService(
    TerminalSessionManager sessionManager,
    CommandSecurityFilter securityFilter
  ) {
    this.sessionManager = sessionManager;
    this.securityFilter = securityFilter;
  }

  // --------------------------------------------------------------------------
  // Public API
  // --------------------------------------------------------------------------

  /**
   * Executes a raw shell command typed by the user in the terminal.
   * The command is validated by {@link CommandSecurityFilter} before
   * any process is spawned.
   */
  public void execute(String clientId, String command) {
    TerminalSessionManager.TerminalSession session =
      sessionManager.getSession(clientId);

    if (session == null) {
      return;
    }

    WebSocketSession socket = session.getSocket();

    // Security validation first — before touching any OS resources
    CommandSecurityFilter.ValidationResult security =
      securityFilter.validate(command);

    if (!security.ok()) {
      sendSafely(socket, "\r\n\u001B[31m[Blocked] " + security.reason() + "\u001B[0m\r\n");
      sendSafely(socket, "$ ");
      return;
    }

    Process existingProcess = runningProcesses.get(clientId);
    if (existingProcess != null && existingProcess.isAlive()) {
      sendSafely(socket, "\r\nA process is already running. Press Ctrl+C to stop it.\r\n");
      return;
    }

    executor.submit(() -> {
      Process process = null;
      try {
        process = startProcess(command, null);
        runningProcesses.put(clientId, process);
        streamOutput(socket, process);

        int exitCode = process.waitFor();
        if (exitCode != 0 && !Thread.currentThread().isInterrupted()) {
          send(socket, "[Process exited with code " + exitCode + "]\r\n");
        }

      } catch (IOException | InterruptedException error) {
        if (error instanceof InterruptedException) {
          Thread.currentThread().interrupt();
        }
        sendSafely(socket, "\r\n[Execution error] " + error.getMessage() + "\r\n");
      } finally {
        destroyProcess(clientId, process);
        sendSafely(socket, "$ ");
      }
    });
  }

  /**
   * Compiles and runs the editor code for the given language.
   * The execution is subject to a hard {@value #EXECUTION_TIMEOUT_SECONDS}-second
   * wall-clock timeout; the process is destroyed forcibly if it overruns.
   */
  public void executeCode(String clientId, String language, String code) {
    TerminalSessionManager.TerminalSession session =
      sessionManager.getSession(clientId);

    if (session == null) {
      return;
    }

    WebSocketSession socket = session.getSocket();

    // Enforce code size limit
    if (code != null && code.getBytes(StandardCharsets.UTF_8).length > MAX_CODE_BYTES) {
      sendSafely(socket, "\r\n\u001B[31m[Error] Code exceeds the 100 KB size limit.\u001B[0m\r\n");
      sendSafely(socket, "$ ");
      return;
    }

    // Stop any running process first
    Process existingProcess = runningProcesses.get(clientId);
    if (existingProcess != null && existingProcess.isAlive()) {
      sendSafely(socket, "\r\nStopping previous execution...\r\n");
      interrupt(clientId);
      try {
        Thread.sleep(200);
      } catch (InterruptedException ignored) {
        Thread.currentThread().interrupt();
      }
    }

    executor.submit(() -> {
      String fileName = getFileNameForLanguage(language);
      String runCmd  = getRunCommandForLanguage(language, fileName);

      sendSafely(socket,
        "\r\n\u001B[36m=== Compiling & Running " + language.toUpperCase()
          + " (" + fileName + ") ===\u001B[0m\r\n");

      // Write code file into the container or local temp dir
      boolean writtenToDocker = writeFileToRunner(fileName, code);
      if (!writtenToDocker) {
        writeLocalFileFallback(clientId, fileName, code);
      }

      runProcessWithTimeout(socket, clientId, runCmd);
    });
  }

  /**
   * Compiles and runs a multi-file workspace.
   * All files are written into the runner directory before execution.
   */
  public void executeProject(
    String clientId,
    String activeFile,
    String language,
    Map<String, String> files
  ) {
    if (files == null || files.isEmpty()) {
      executeCode(clientId, language, "");
      return;
    }

    TerminalSessionManager.TerminalSession session =
      sessionManager.getSession(clientId);

    if (session == null) {
      return;
    }

    WebSocketSession socket = session.getSocket();

    // Stop any running process first
    Process existingProcess = runningProcesses.get(clientId);
    if (existingProcess != null && existingProcess.isAlive()) {
      sendSafely(socket, "\r\nStopping previous execution...\r\n");
      interrupt(clientId);
      try {
        Thread.sleep(200);
      } catch (InterruptedException ignored) {
        Thread.currentThread().interrupt();
      }
    }

    executor.submit(() -> {
      String entryFile = (activeFile != null && !activeFile.isBlank())
        ? activeFile
        : getFileNameForLanguage(language);

      sendSafely(socket,
        "\r\n\u001B[36m=== Compiling & Running Project (" + files.size() + " files, entry: "
          + entryFile + ") ===\u001B[0m\r\n");

      // Write all files into runner
      for (Map.Entry<String, String> entry : files.entrySet()) {
        String fname = entry.getKey();
        String fileCode = entry.getValue();
        boolean written = writeFileToRunner(fname, fileCode);
        if (!written) {
          writeLocalFileFallback(clientId, fname, fileCode);
        }
      }

      String runCmd = getProjectRunCommand(language, entryFile);
      runProcessWithTimeout(socket, clientId, runCmd);
    });
  }

  private void runProcessWithTimeout(
    WebSocketSession socket,
    String clientId,
    String runCmd
  ) {
    Process process = null;
    boolean timedOut = false;

    try {
      Path localDir = Paths.get(
        System.getProperty("java.io.tmpdir"), "syncstream", "runner", clientId
      );

      process = startProcess(runCmd, Files.exists(localDir) ? localDir.toFile() : null);
      runningProcesses.put(clientId, process);

      final Process finalProcess = process;
      ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor();
      ScheduledFuture<?> timeoutTask = scheduler.schedule(() -> {
        if (finalProcess.isAlive()) {
          finalProcess.destroyForcibly();
        }
      }, EXECUTION_TIMEOUT_SECONDS, TimeUnit.SECONDS);

      streamOutput(socket, process);

      int exitCode = process.waitFor();
      timedOut = !timeoutTask.cancel(false);
      scheduler.shutdown();
      try {
        if (!scheduler.awaitTermination(200, TimeUnit.MILLISECONDS)) {
          scheduler.shutdownNow();
        }
      } catch (InterruptedException e) {
        scheduler.shutdownNow();
        Thread.currentThread().interrupt();
      }

      if (timedOut) {
        send(socket,
          "\u001B[33m=== Execution timed out after " + EXECUTION_TIMEOUT_SECONDS
            + "s ===\u001B[0m\r\n");
      } else if (exitCode == 0) {
        send(socket, "\u001B[32m=== Execution Finished (Exit Code: 0) ===\u001B[0m\r\n");
      } else {
        send(socket, "\u001B[31m=== Execution Exited with Code " + exitCode + " ===\u001B[0m\r\n");
      }

    } catch (IOException | InterruptedException error) {
      if (error instanceof InterruptedException) {
        Thread.currentThread().interrupt();
      }
      sendSafely(socket, "\r\n[Execution error] " + error.getMessage() + "\r\n");
    } finally {
      destroyProcess(clientId, process);
      sendSafely(socket, "$ ");
    }
  }

  private String getProjectRunCommand(String language, String entryFile) {
    return switch (language.toLowerCase()) {
      case "python" -> "python3 -u " + entryFile + " 2>&1 || python -u " + entryFile + " 2>&1";
      case "javascript" -> "node " + entryFile + " 2>&1";
      case "typescript" -> "npx --yes tsx " + entryFile + " 2>&1 || npx --yes ts-node " + entryFile + " 2>&1 || node " + entryFile + " 2>&1";
      case "java" -> "javac -encoding UTF-8 $(find . -name \"*.java\") 2>&1 && (java -cp . " + entryFile.replace(".java", "").replace('/', '.') + " 2>&1 || java -cp . " + entryFile.replace(".java", "").substring(entryFile.lastIndexOf('/') + 1) + " 2>&1)";
      case "cpp" -> "g++ -O2 -std=c++17 -Wall -Wextra $(find . -name \"*.cpp\") -o main_bin 2>&1 && ./main_bin";
      case "c" -> "gcc -O2 -Wall -Wextra $(find . -name \"*.c\") -o main_bin 2>&1 && ./main_bin";
      case "go" -> "(go mod init runner 2>/dev/null || true) && go run . 2>&1";
      case "rust" -> "rustc " + entryFile + " -o main_bin 2>&1 && ./main_bin";
      case "ruby" -> "ruby " + entryFile + " 2>&1";
      case "php" -> "php " + entryFile + " 2>&1";
      default -> getRunCommandForLanguage(language, entryFile);
    };
  }

  // --------------------------------------------------------------------------
  // Process management helpers
  // --------------------------------------------------------------------------

  /**
   * Sends text input to the currently running process for a given client (stdin).
   *
   * @param clientId the client identifier
   * @param input the text input to send to standard input
   * @return true if input was written, false if no process was running
   */
  public boolean sendInput(String clientId, String input) {
    Process process = runningProcesses.get(clientId);
    if (process == null || !process.isAlive()) {
      return false;
    }

    try {
      OutputStream os = process.getOutputStream();
      if (os != null) {
        String formatted = input.endsWith("\n") ? input : input + "\n";
        os.write(formatted.getBytes(StandardCharsets.UTF_8));
        os.flush();
        return true;
      }
    } catch (IOException e) {
      logger.debug("Failed sending input to process for clientId={}: {}", clientId, e.getMessage());
    }
    return false;
  }

  /**
   * Starts a process using Docker exec when available, falling back to a
   * direct OS shell when Docker is not running.
   */
  private Process startProcess(String command, File workingDirectory) throws IOException {
    // Process-level sandbox limits: max 50 processes/threads, 35s CPU limit, 10MB file limit
    String sandboxedCommand = "ulimit -u 50 -t 35 -f 10240 2>/dev/null; " + command;

    // Try Docker first — '-i' keeps standard input open for interactive input
    String[] dockerCommand = {
      "docker", "exec", "-i", RUNNER_CONTAINER, "bash", "-lc", sandboxedCommand
    };

    try {
      ProcessBuilder dockerPb = new ProcessBuilder(dockerCommand)
        .redirectErrorStream(true);
      if (workingDirectory != null) {
        dockerPb.directory(workingDirectory);
      }
      return dockerPb.start();
    } catch (IOException dockerEx) {
      logger.debug("Docker unavailable ({}), falling back to local shell", dockerEx.getMessage());
    }

    // Local fallback
    boolean isWindows = System.getProperty("os.name").toLowerCase().contains("win");
    String[] localCommand = isWindows
      ? new String[]{"powershell.exe", "-NoProfile", "-Command", command}
      : new String[]{"bash", "-c", command};

    ProcessBuilder localPb = new ProcessBuilder(localCommand)
      .redirectErrorStream(true);

    // Python: ensure stdout is unbuffered so output streams immediately
    localPb.environment().put("PYTHONUNBUFFERED", "1");

    if (workingDirectory != null) {
      localPb.directory(workingDirectory);
    }

    return localPb.start();
  }

  /**
   * Reads the process stdout/stderr in chunks and forwards immediately to the WebSocket.
   * Uses byte buffers instead of readLine() so interactive prompts without trailing newlines
   * (e.g. input("Enter name: ")) stream to the terminal without delay.
   */
  private void streamOutput(WebSocketSession socket, Process process) throws IOException {
    try (InputStream is = process.getInputStream()) {
      byte[] buffer = new byte[1024];
      int length;
      while ((length = is.read(buffer)) != -1) {
        String chunk = new String(buffer, 0, length, StandardCharsets.UTF_8);
        // Normalize newlines for xterm display
        String normalized = chunk.replace("\r\n", "\n").replace("\n", "\r\n");
        send(socket, normalized);
      }
    }
  }

  private void destroyProcess(String clientId, Process process) {
    if (process != null) {
      runningProcesses.remove(clientId, process);
      if (process.isAlive()) {
        process.destroy();
        if (process.isAlive()) {
          process.destroyForcibly();
        }
      }
    }
  }

  // --------------------------------------------------------------------------
  // File writing helpers
  // --------------------------------------------------------------------------

  private boolean writeFileToRunner(String fileName, String code) {
    try {
      String[] writeCommand = {
        "docker", "exec", "-i", RUNNER_CONTAINER,
        "sh", "-c", "mkdir -p \"$(dirname \"/workspace/" + fileName + "\")\" && cat > \"/workspace/" + fileName + "\""
      };

      Process writeProcess = new ProcessBuilder(writeCommand).start();
      try (OutputStream os = writeProcess.getOutputStream()) {
        os.write(code.getBytes(StandardCharsets.UTF_8));
        os.flush();
      }

      int exitCode = writeProcess.waitFor();
      return exitCode == 0;
    } catch (Exception e) {
      logger.debug("Failed writing file to docker container: {}", e.getMessage());
      return false;
    }
  }

  private void writeLocalFileFallback(String clientId, String fileName, String code) {
    try {
      Path dir = Paths.get(
        System.getProperty("java.io.tmpdir"), "syncstream", "runner", clientId
      );
      Path filePath = dir.resolve(fileName);
      if (filePath.getParent() != null) {
        Files.createDirectories(filePath.getParent());
      }
      Files.writeString(filePath, code, StandardCharsets.UTF_8);
    } catch (IOException e) {
      logger.error("Failed writing local fallback file", e);
    }
  }

  // --------------------------------------------------------------------------
  // Language metadata
  // --------------------------------------------------------------------------

  private String getFileNameForLanguage(String language) {
    return switch (language.toLowerCase()) {
      case "python"     -> "main.py";
      case "java"       -> "Main.java";
      case "cpp"        -> "main.cpp";
      case "c"          -> "main.c";
      case "javascript" -> "index.js";
      case "typescript" -> "index.ts";
      case "go"         -> "main.go";
      case "rust"       -> "main.rs";
      case "csharp"     -> "Program.cs";
      case "ruby"       -> "main.rb";
      case "php"        -> "index.php";
      case "kotlin"     -> "main.kt";
      case "swift"      -> "main.swift";
      case "sql"        -> "query.sql";
      case "html"       -> "index.html";
      case "css"        -> "style.css";
      case "json"       -> "data.json";
      default           -> "code.txt";
    };
  }

  private String getRunCommandForLanguage(String language, String fileName) {
    return switch (language.toLowerCase()) {
      // Python: -u for unbuffered output so lines stream immediately
      case "python" ->
        "python3 -u " + fileName + " || python -u " + fileName;

      case "javascript" ->
        "node " + fileName;

      case "typescript" ->
        "npx --yes tsx " + fileName + " 2>&1 || npx --yes ts-node " + fileName + " 2>&1 || node " + fileName;

      // Java: UTF-8 encoding, classpath set to current directory
      case "java" ->
        "javac -encoding UTF-8 Main.java 2>&1 && java -cp . Main";

      // C++: warnings enabled, C++17
      case "cpp" ->
        "g++ -O2 -std=c++17 -Wall -Wextra -o main_bin main.cpp 2>&1 && ./main_bin";

      // C: warnings enabled
      case "c" ->
        "gcc -O2 -Wall -Wextra -o main_bin main.c 2>&1 && ./main_bin";

      // Go: initialise a temporary module so 'go run' works without a module file
      case "go" ->
        "(go mod init runner 2>/dev/null || true) && go run main.go 2>&1";

      // Rust: use a unique binary name to avoid collision with source file
      case "rust" ->
        "rustc main.rs -o main_bin 2>&1 && ./main_bin";

      // C#: prefer dotnet-script, fall back to mcs/mono
      case "csharp" ->
        "dotnet-script Program.cs 2>&1 || (mcs -out:Program.exe Program.cs 2>&1 && mono Program.exe) || dotnet run 2>&1";

      // Ruby
      case "ruby" ->
        "ruby main.rb 2>&1";

      // PHP
      case "php" ->
        "php index.php 2>&1";

      // Kotlin: compile then run
      case "kotlin" ->
        "kotlinc main.kt -include-runtime -d main.jar 2>&1 && java -jar main.jar";

      // Swift
      case "swift" ->
        "swift main.swift 2>&1";

      case "sql" ->
        "cat query.sql";

      default ->
        "cat " + fileName;
    };
  }

  // --------------------------------------------------------------------------
  // Interrupt / status
  // --------------------------------------------------------------------------

  public void interrupt(String clientId) {
    Process process = runningProcesses.get(clientId);
    if (process == null || !process.isAlive()) {
      return;
    }
    process.destroy();
    if (process.isAlive()) {
      process.destroyForcibly();
    }
  }

  public boolean isRunning(String clientId) {
    Process process = runningProcesses.get(clientId);
    return process != null && process.isAlive();
  }

  // --------------------------------------------------------------------------
  // WebSocket send helpers
  // --------------------------------------------------------------------------

  private void send(WebSocketSession socket, String output) throws IOException {
    if (socket != null && socket.isOpen()) {
      synchronized (socket) {
        socket.sendMessage(new TextMessage(output));
      }
    }
  }

  private void sendSafely(WebSocketSession socket, String output) {
    try {
      send(socket, output);
    } catch (IOException ignored) {
      // Socket already closed.
    }
  }
}
