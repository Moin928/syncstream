package com.syncstream.backend;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class BackendApplication {

  public static void main(String[] args) {

    // starts the spring boot application
    SpringApplication.run(
      BackendApplication.class,
      args
    );
  }
}
