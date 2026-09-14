package com.syncstream.backend.services;

import com.syncstream.backend.websocket.TerminalSessionManager;
import org.springframework.stereotype.Service;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@Service
public class TerminalExecutionService {

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
    this.sessionManager =
      sessionManager;
  }

  public void execute(
    String clientId,
    String command
  ) {

    TerminalSessionManager.TerminalSession session =
      sessionManager.getSession(
        clientId
      );

    if (session == null) {
      return;
    }

    WebSocketSession socket =
      session.getSocket();

    Process existingProcess =
      runningProcesses.get(clientId);

    if (
      existingProcess != null &&
        existingProcess.isAlive()
    ) {
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

        process =
          new ProcessBuilder(
            dockerCommand
          )
            .redirectErrorStream(true)
            .start();

        runningProcesses.put(
          clientId,
          process
        );

        try (
          BufferedReader reader =
            new BufferedReader(
              new InputStreamReader(
                process.getInputStream(),
                StandardCharsets.UTF_8
              )
            )
        ) {

          String line;

          while (
            (line =
              reader.readLine()) != null
          ) {

            send(
              socket,
              line + "\r\n"
            );
          }
        }

        int exitCode =
          process.waitFor();

        if (
          exitCode != 0 &&
            !Thread.currentThread().isInterrupted()
        ) {

          send(
            socket,
            "[Process exited with code "
              + exitCode
              + "]\r\n"
          );
        }

      } catch (
        IOException
        | InterruptedException error
      ) {

        if (
          error instanceof
            InterruptedException
        ) {
          Thread.currentThread()
            .interrupt();
        }

        sendSafely(
          socket,
          "\r\n[Execution error] "
            + error.getMessage()
            + "\r\n"
        );

      } finally {

        if (process != null) {

          runningProcesses.remove(
            clientId,
            process
          );

          if (process.isAlive()) {
            process.destroy();
          }
        }

        sendSafely(
          socket,
          "$ "
        );
      }
    });
  }

  public void interrupt(
    String clientId
  ) {

    Process process =
      runningProcesses.get(
        clientId
      );

    if (
      process == null ||
        !process.isAlive()
    ) {
      return;
    }

    process.destroy();

    if (process.isAlive()) {
      process.destroyForcibly();
    }
  }

  public boolean isRunning(
    String clientId
  ) {

    Process process =
      runningProcesses.get(
        clientId
      );

    return process != null &&
      process.isAlive();
  }

  private void send(
    WebSocketSession socket,
    String output
  ) throws IOException {

    if (
      socket != null &&
        socket.isOpen()
    ) {

      synchronized (socket) {

        socket.sendMessage(
          new TextMessage(
            output
          )
        );
      }
    }
  }

  private void sendSafely(
    WebSocketSession socket,
    String output
  ) {

    try {
      send(
        socket,
        output
      );
    } catch (IOException ignored) {
      // Socket already closed.
    }
  }
}
