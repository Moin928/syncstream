package com.syncstream.backend.services;

import com.syncstream.backend.websocket.TerminalSessionManager;
import org.springframework.stereotype.Service;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@Service
public class TerminalExecutionService {

  private final TerminalSessionManager sessionManager;

  private final ExecutorService executor =
    Executors.newCachedThreadPool();

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

    executor.submit(() -> {

      Process process = null;

      try {

        String[] shellCommand =
          getShellCommand(command);

        process =
          new ProcessBuilder(
            shellCommand
          )
            .directory(
              new java.io.File(
                System.getProperty(
                  "user.dir"
                )
              )
            )
            .redirectErrorStream(true)
            .start();

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

        if (exitCode != 0) {
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

        try {
          send(
            socket,
            "\r\n[Execution error] "
              + error.getMessage()
              + "\r\n"
          );
        } catch (
          IOException ignored
        ) {
          // Socket already closed.
        }

      } finally {

        if (process != null) {
          process.destroy();
        }

        try {
          send(
            socket,
            "$ "
          );
        } catch (
          IOException ignored
        ) {
          // Socket already closed.
        }
      }
    });
  }

  private String[] getShellCommand(
    String command
  ) {

    String operatingSystem =
      System.getProperty(
        "os.name"
      ).toLowerCase();

    if (
      operatingSystem.contains(
        "win"
      )
    ) {
      return new String[] {
        "cmd.exe",
        "/c",
        command
      };
    }

    return new String[] {
      "/bin/sh",
      "-c",
      command
    };
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
}
