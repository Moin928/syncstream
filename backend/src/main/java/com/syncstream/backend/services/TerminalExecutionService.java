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
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@Service
public class TerminalExecutionService {

  private static final Logger logger =
    LoggerFactory.getLogger(TerminalExecutionService.class);

  private final TerminalSessionManager sessionManager;

  private final ExecutorService executor =
    Executors.newCachedThreadPool();

  private final Map<String, Process> runningProcesses =
    new ConcurrentHashMap<>();

  private static final String RUNNER_CONTAINER =
    "syncstream-runner";

  public TerminalExecutionService(
    TerminalSessionManager sessionManager
  ) {
    this.sessionManager = sessionManager;
  }

  public void execute(
    String clientId,
    String command
  ) {
    TerminalSessionManager.TerminalSession session =
      sessionManager.getSession(clientId);

    if (session == null) {
      return;
    }

    WebSocketSession socket =
      session.getSocket();

    Process existingProcess =
      runningProcesses.get(clientId);

    if (existingProcess != null && existingProcess.isAlive()) {
      sendSafely(
        socket,
        "\r\nA process is already running. Press Ctrl+C to stop it.\r\n"
      );
      return;
    }

    executor.submit(() -> {
      Process process = null;

      try {
        String[] dockerCommand = {
          "docker",
          "exec",
          RUNNER_CONTAINER,
          "bash",
          "-lc",
          command
        };

        boolean useDocker = true;
        try {
          process = new ProcessBuilder(dockerCommand)
            .redirectErrorStream(true)
            .start();
        } catch (IOException ex) {
          useDocker = false;
        }

        // Fallback to local execution if docker is unavailable
        if (!useDocker || process == null) {
          boolean isWindows = System.getProperty("os.name").toLowerCase().contains("win");
          String[] localCommand = isWindows
            ? new String[]{"powershell.exe", "-NoProfile", "-Command", command}
            : new String[]{"bash", "-c", command};

          process = new ProcessBuilder(localCommand)
            .redirectErrorStream(true)
            .start();
        }

        runningProcesses.put(clientId, process);

        try (
          BufferedReader reader = new BufferedReader(
            new InputStreamReader(process.getInputStream(), StandardCharsets.UTF_8)
          )
        ) {
          String line;
          while ((line = reader.readLine()) != null) {
            send(socket, line + "\r\n");
          }
        }

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
        if (process != null) {
          runningProcesses.remove(clientId, process);
          if (process.isAlive()) {
            process.destroy();
          }
        }
        sendSafely(socket, "$ ");
      }
    });
  }

  /**
   * Directly write code file and compile/run it in the container or local runner.
   */
  public void executeCode(
    String clientId,
    String language,
    String code
  ) {
    TerminalSessionManager.TerminalSession session =
      sessionManager.getSession(clientId);

    if (session == null) {
      return;
    }

    WebSocketSession socket = session.getSocket();

    Process existingProcess = runningProcesses.get(clientId);
    if (existingProcess != null && existingProcess.isAlive()) {
      sendSafely(socket, "\r\nA process is already running. Stopping previous execution...\r\n");
      interrupt(clientId);
      try {
        Thread.sleep(200);
      } catch (InterruptedException ignored) {}
    }

    executor.submit(() -> {
      String fileName = getFileNameForLanguage(language);
      String runCmd = getRunCommandForLanguage(language, fileName);

      sendSafely(socket, "\r\n\u001B[36m=== Compiling & Running " + language.toUpperCase() + " (" + fileName + ") ===\u001B[0m\r\n");

      boolean written = writeFileToRunner(fileName, code);
      if (!written) {
        // Try local file fallback
        writeLocalFileFallback(clientId, fileName, code);
      }

      Process process = null;
      try {
        String[] dockerCommand = {
          "docker",
          "exec",
          RUNNER_CONTAINER,
          "bash",
          "-lc",
          runCmd
        };

        boolean useDocker = true;
        try {
          process = new ProcessBuilder(dockerCommand)
            .redirectErrorStream(true)
            .start();
        } catch (IOException ex) {
          useDocker = false;
        }

        if (!useDocker || process == null) {
          Path localDir = Paths.get(System.getProperty("java.io.tmpdir"), "syncstream", "runner", clientId);
          boolean isWindows = System.getProperty("os.name").toLowerCase().contains("win");
          String[] localCommand = isWindows
            ? new String[]{"powershell.exe", "-NoProfile", "-Command", runCmd}
            : new String[]{"bash", "-c", runCmd};

          ProcessBuilder pb = new ProcessBuilder(localCommand).redirectErrorStream(true);
          if (Files.exists(localDir)) {
            pb.directory(localDir.toFile());
          }
          process = pb.start();
        }

        runningProcesses.put(clientId, process);

        try (
          BufferedReader reader = new BufferedReader(
            new InputStreamReader(process.getInputStream(), StandardCharsets.UTF_8)
          )
        ) {
          String line;
          while ((line = reader.readLine()) != null) {
            send(socket, line + "\r\n");
          }
        }

        int exitCode = process.waitFor();
        if (exitCode == 0) {
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
        if (process != null) {
          runningProcesses.remove(clientId, process);
          if (process.isAlive()) {
            process.destroy();
          }
        }
        sendSafely(socket, "$ ");
      }
    });
  }

  private boolean writeFileToRunner(String fileName, String code) {
    try {
      String[] writeCommand = {
        "docker",
        "exec",
        "-i",
        RUNNER_CONTAINER,
        "sh",
        "-c",
        "cat > /workspace/" + fileName
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
      Path dir = Paths.get(System.getProperty("java.io.tmpdir"), "syncstream", "runner", clientId);
      Files.createDirectories(dir);
      Path filePath = dir.resolve(fileName);
      Files.writeString(filePath, code, StandardCharsets.UTF_8);
    } catch (IOException e) {
      logger.error("Failed writing local fallback file", e);
    }
  }

  private String getFileNameForLanguage(String language) {
    switch (language.toLowerCase()) {
      case "python":
        return "main.py";
      case "java":
        return "Main.java";
      case "cpp":
        return "main.cpp";
      case "c":
        return "main.c";
      case "javascript":
        return "index.js";
      case "typescript":
        return "index.ts";
      case "go":
        return "main.go";
      case "rust":
        return "main.rs";
      case "csharp":
        return "Program.cs";
      case "sql":
        return "query.sql";
      case "html":
        return "index.html";
      case "css":
        return "style.css";
      case "json":
        return "data.json";
      default:
        return "code.txt";
    }
  }

  private String getRunCommandForLanguage(String language, String fileName) {
    switch (language.toLowerCase()) {
      case "python":
        return "python3 " + fileName + " || python " + fileName;
      case "javascript":
        return "node " + fileName;
      case "typescript":
        return "npx -y tsx " + fileName + " || ts-node " + fileName + " || node " + fileName;
      case "java":
        return "javac Main.java && java Main";
      case "cpp":
        return "g++ -O2 -std=c++17 main.cpp -o main && ./main";
      case "c":
        return "gcc -O2 main.c -o main && ./main";
      case "go":
        return "go run main.go";
      case "rust":
        return "rustc main.rs -o main && ./main";
      case "csharp":
        return "dotnet run || csc Program.cs && mono Program.exe";
      case "sql":
        return "cat query.sql";
      default:
        return "cat " + fileName;
    }
  }

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
