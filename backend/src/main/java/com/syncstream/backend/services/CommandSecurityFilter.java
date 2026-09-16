package com.syncstream.backend.services;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.regex.Pattern;

/**
 * Security layer that validates shell commands before they are executed
 * inside the runner container or on the local host.
 *
 * <p>The filter uses two strategies:
 * <ol>
 *   <li>A list of exact and substring matches for well-known dangerous strings.</li>
 *   <li>A set of regular-expression patterns for structural attacks that cannot
 *       be caught with simple string containment.</li>
 * </ol>
 *
 * <p>None of these checks replace proper sandboxing (Docker, seccomp, AppArmor, etc.)
 * — they add a defence-in-depth layer that gives the end user a meaningful error
 * message instead of silently destroying the environment.
 */
@Component
public class CommandSecurityFilter {

  private static final Logger logger =
    LoggerFactory.getLogger(CommandSecurityFilter.class);

  // --------------------------------------------------------------------------
  // Result type
  // --------------------------------------------------------------------------

  public record ValidationResult(boolean ok, String reason) {
    public static ValidationResult allow() {
      return new ValidationResult(true, null);
    }

    public static ValidationResult block(String reason) {
      return new ValidationResult(false, reason);
    }
  }

  // --------------------------------------------------------------------------
  // Exact / substring blocklist — trimmed lowercase match
  // --------------------------------------------------------------------------

  /**
   * Dangerous substrings. A command is rejected if its lower-cased form
   * contains any of these strings.
   */
  private static final List<String> BLOCKED_SUBSTRINGS = List.of(
    // Fork bomb (bash / zsh / sh variants)
    ":(){ :|:",
    ":(){ :|:& };:",
    ":(){:|:& };:",

    // Recursive filesystem destruction
    "rm -rf /",
    "rm -rf /*",
    "rm -rf ~",
    "rm -rf .",
    "rm --no-preserve-root",
    "rimraf /",

    // Overwrite system block devices
    "dd if=/dev/zero of=/dev/sd",
    "dd if=/dev/random of=/dev/sd",
    "dd if=/dev/urandom of=/dev/sd",
    "> /dev/sda",
    ">/dev/sda",
    "> /dev/sdb",
    ">/dev/sdb",
    "> /dev/nvme",
    ">/dev/nvme",

    // Format block devices
    "mkfs",
    "mke2fs",
    "mkswap /dev/",

    // System control
    "shutdown",
    "reboot",
    "halt",
    "poweroff",
    "init 0",
    "init 6",
    "systemctl poweroff",
    "systemctl reboot",
    "systemctl halt",

    // Process 1 kill (crash host)
    "kill -9 1",
    "kill -9 -1",
    "kill -kill 1",
    "killall -9",

    // Privilege escalation
    "sudo su",
    "sudo bash",
    "sudo -s",
    "sudo -i",
    "chmod 777 /etc",
    "chmod 777 /bin",
    "chmod 777 /usr",
    "chmod 777 /root",
    "chmod -r 000",
    "chown -r root",

    // Credential and config poisoning
    "> /etc/passwd",
    "> /etc/shadow",
    "> /etc/sudoers",
    ">> /etc/passwd",
    ">> /etc/shadow",
    "visudo",
    "passwd root",

    // Firewall teardown
    "iptables -f",
    "iptables --flush",
    "ufw disable",
    "ufw reset",

    // Cron / scheduled task destruction
    "crontab -r",
    "rm -rf /var/spool/cron",

    // Reverse shells and network exfil (common payloads)
    "bash -i >& /dev/tcp",
    "bash -i>&/dev/tcp",
    "nc -e /bin/bash",
    "nc -e /bin/sh",
    "ncat -e /bin/bash",
    "python -c 'import socket",
    "python3 -c 'import socket",
    "/dev/tcp/",
    "/dev/udp/",

    // Kernel module / hardware manipulation
    "insmod",
    "rmmod",
    "modprobe",

    // Mount / unmount
    "mount /dev/",
    "umount /",
    "umount -a",

    // Crypto-miner patterns (common)
    "xmrig",
    "minerd",
    "cryptonight",
    "stratum+tcp",

    // Overwrite workspace entirely
    "rm -rf /workspace",
    "rm -rf /home"
  );

  // --------------------------------------------------------------------------
  // Regex blocklist — structural attacks
  // --------------------------------------------------------------------------

  /**
   * Regular expressions applied to the raw (un-lowercased) command.
   * Use case-insensitive flags where needed.
   */
  private static final List<Pattern> BLOCKED_PATTERNS = List.of(
    // Fork bombs — function definitions that recurse into themselves
    Pattern.compile(":\\(\\)\\s*\\{.*\\|.*\\}", Pattern.DOTALL),

    // Nohup + background detached process trying to survive shell exit
    Pattern.compile("nohup\\s+.+\\s*&\\s*$"),

    // Python/Perl/Ruby one-liner reverse shells
    Pattern.compile("(?i)(python|perl|ruby)\\d*\\s+-[ce]\\s+['\"].*socket.*"),

    // wget/curl piped to bash (download & execute)
    Pattern.compile("(?i)(wget|curl)\\s+.+\\s*\\|\\s*(bash|sh|zsh|fish|python|perl|ruby)"),

    // Base64 decode piped to shell (obfuscated execution)
    Pattern.compile("(?i)base64\\s*(-d|--decode)?\\s*[|>]\\s*(bash|sh|zsh|python|perl|ruby|exec)"),

    // Kernel panic trigger via sysrq
    Pattern.compile("(?i)echo\\s+[bBcC]\\s*>\\s*/proc/sysrq-trigger"),

    // /proc/sys writes (dangerous kernel parameter changes)
    Pattern.compile("(?i)echo\\s+.+\\s*>\\s*/proc/sys/"),

    // Bash history wipe
    Pattern.compile("(?i)(history\\s+-[cw]|rm\\s+~/.bash_history|>\\s*~/.bash_history)"),

    // Attempts to escape Docker via /proc/1/root or similar
    Pattern.compile("(?i)/proc/1/(root|exe|fd|maps|mem)"),

    // nsenter — namespace breakout tool
    Pattern.compile("(?i)nsenter"),

    // Docker socket access from inside container
    Pattern.compile("(?i)/var/run/docker\\.sock"),

    // Excessive redirection attempts (> 3 redirects in one line — unusual)
    Pattern.compile("([|>]{3,})"),

    // Glob-based rm of root-level directories
    Pattern.compile("(?i)rm\\s+(-[a-zA-Z]*f[a-zA-Z]*\\s+|--force\\s+)?/[a-z*]+")
  );

  // --------------------------------------------------------------------------
  // Public API
  // --------------------------------------------------------------------------

  /**
   * Validates a shell command string.
   *
   * @param command the raw command typed by the user
   * @return {@link ValidationResult#allow()} when safe,
   *         {@link ValidationResult#block(String)} when dangerous
   */
  public ValidationResult validate(String command) {
    if (command == null || command.isBlank()) {
      return ValidationResult.allow();
    }

    if (command.length() > 4096) {
      logger.warn("Blocked excessively long command (length: {})", command.length());
      return ValidationResult.block("Command exceeds maximum allowed length of 4096 characters.");
    }

    String lowered = command.toLowerCase().trim();

    // 1. Substring checks
    for (String blocked : BLOCKED_SUBSTRINGS) {
      if (lowered.contains(blocked)) {
        logger.warn(
          "Blocked command (substring match '{}'): {}",
          blocked,
          sanitiseForLog(command)
        );

        return ValidationResult.block(
          "Command blocked by security policy: contains prohibited pattern '" + blocked + "'."
        );
      }
    }

    // 2. Regex checks
    for (Pattern pattern : BLOCKED_PATTERNS) {
      if (pattern.matcher(command).find()) {
        logger.warn(
          "Blocked command (pattern '{}' matched): {}",
          pattern.pattern(),
          sanitiseForLog(command)
        );

        return ValidationResult.block(
          "Command blocked by security policy: matches prohibited pattern."
        );
      }
    }

    return ValidationResult.allow();
  }

  // --------------------------------------------------------------------------
  // Helpers
  // --------------------------------------------------------------------------

  /**
   * Truncates a command string for safe log output so secrets / long payloads
   * do not flood the log.
   */
  private static String sanitiseForLog(String command) {
    if (command.length() <= 120) {
      return command;
    }
    return command.substring(0, 120) + "...[truncated]";
  }
}
