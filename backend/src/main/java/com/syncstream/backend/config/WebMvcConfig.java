package com.syncstream.backend.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Centralized Spring MVC configuration for CORS and request mappings.
 */
@Configuration
public class WebMvcConfig implements WebMvcConfigurer {

  @Value("${syncstream.websocket.allowed-origins:http://localhost:5173,http://localhost:4173,http://localhost:3000}")
  private String allowedOriginsConfig;

  @Override
  public void addCorsMappings(CorsRegistry registry) {
    String[] origins = allowedOriginsConfig.split(",");

    registry.addMapping("/**")
      .allowedOrigins(origins)
      .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
      .allowedHeaders("*")
      .allowCredentials(true)
      .maxAge(3600);
  }
}
