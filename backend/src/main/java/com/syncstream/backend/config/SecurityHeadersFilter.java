package com.syncstream.backend.config;

import jakarta.servlet.*;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.io.IOException;

/**
 * Filter that attaches OWASP-recommended HTTP security response headers to all responses.
 */
@Component
@Order(1)
public class SecurityHeadersFilter implements Filter {

  @Override
  public void doFilter(
    ServletRequest request,
    ServletResponse response,
    FilterChain chain
  ) throws IOException, ServletException {

    if (response instanceof HttpServletResponse httpServletResponse) {
      // Prevents MIME-sniffing
      httpServletResponse.setHeader("X-Content-Type-Options", "nosniff");

      // Clickjacking protection
      httpServletResponse.setHeader("X-Frame-Options", "SAMEORIGIN");

      // Cross-site scripting (XSS) filter
      httpServletResponse.setHeader("X-XSS-Protection", "1; mode=block");

      // Controls how much referrer information is sent
      httpServletResponse.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

      // Restricts access to sensitive browser features / APIs
      httpServletResponse.setHeader(
        "Permissions-Policy",
        "camera=(), microphone=(), geolocation=(), payment=(), usb=()"
      );

      // Defense-in-depth Content-Security-Policy
      httpServletResponse.setHeader(
        "Content-Security-Policy",
        "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' ws: wss: http: https:;"
      );
    }

    chain.doFilter(request, response);
  }
}
