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

    // ── Fork bombs ────────────────────────────────────────────────────────
    ":(){ :|:",
    ":(){ :|:& };:",
    ":(){:|:& };:",

    // ── Recursive filesystem destruction ──────────────────────────────────
    "rm -rf /",
    "rm -rf /*",
    "rm -rf ~",
    "rm -rf .",
    "rm --no-preserve-root",
    "rimraf /",

    // ── Block-device overwrite ────────────────────────────────────────────
    "dd if=/dev/zero of=/dev/sd",
    "dd if=/dev/random of=/dev/sd",
    "dd if=/dev/urandom of=/dev/sd",
    "> /dev/sda",
    ">/dev/sda",
    "> /dev/sdb",
    ">/dev/sdb",
    "> /dev/nvme",
    ">/dev/nvme",

    // ── Format block devices ──────────────────────────────────────────────
    "mkfs",
    "mke2fs",
    "mkswap /dev/",

    // ── System control / shutdown ─────────────────────────────────────────
    "shutdown",
    "reboot",
    "halt",
    "poweroff",
    "init 0",
    "init 6",
    "systemctl poweroff",
    "systemctl reboot",
    "systemctl halt",

    // ── Process kill ──────────────────────────────────────────────────────
    "kill -9 1",
    "kill -9 -1",
    "kill -kill 1",
    "killall -9",

    // ── Privilege escalation ──────────────────────────────────────────────
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
    "chmod +s",        // SUID bit — setuid escalation

    // ── Credential / config poisoning ─────────────────────────────────────
    "> /etc/passwd",
    "> /etc/shadow",
    "> /etc/sudoers",
    ">> /etc/passwd",
    ">> /etc/shadow",
    "visudo",
    "passwd root",
    "tee /etc/",       // tee write to /etc/*
    "tee /proc/",      // tee write to /proc/*

    // ── Dynamic linker hijacking ──────────────────────────────────────────
    "ld_preload",
    "ld_library_path=/",
    "ld_audit",

    // ── Firewall teardown ──────────────────────────────────────────────────
    "iptables -f",
    "iptables --flush",
    "ufw disable",
    "ufw reset",

    // ── Cron / scheduled task destruction ────────────────────────────────
    "crontab -r",
    "rm -rf /var/spool/cron",
    "/etc/cron",       // writing to any cron directory

    // ── Reverse shells & network exfil ───────────────────────────────────
    "bash -i >& /dev/tcp",
    "bash -i>&/dev/tcp",
    "nc -e /bin/bash",
    "nc -e /bin/sh",
    "ncat -e /bin/bash",
    "python -c 'import socket",
    "python3 -c 'import socket",
    "/dev/tcp/",
    "/dev/udp/",
    "socat tcp",             // socat TCP reverse shells
    "socat udp",
    "socat exec",

    // ── Exfiltration via env vars ─────────────────────────────────────────
    "env | nc",
    "env | curl",
    "env | wget",
    "printenv | nc",
    "printenv | curl",
    "printenv | wget",
    "cat /proc/*/environ",

    // ── Read sensitive files ──────────────────────────────────────────────
    "cat /etc/passwd",
    "cat /etc/shadow",
    "cat /etc/sudoers",
    "cat /root/",
    "cat /proc/keys",

    // ── Exfiltration HTTP servers inside the container ───────────────────
    "python -m http.server",
    "python3 -m http.server",
    "python -m simplehttpserver",
    "python3 -m simplehttpserver",

    // ── Package installs from remote URLs ─────────────────────────────────
    "pip install -r http",
    "pip3 install -r http",
    "npm install http",
    "gem install --remote",

    // ── Git — fetch arbitrary (potentially malicious) remote code ─────────
    "git clone",
    "git fetch",
    "git pull",
    "git submodule",

    // ── Kernel module / hardware manipulation ────────────────────────────
    "insmod",
    "rmmod",
    "modprobe",

    // ── Mount / unmount ───────────────────────────────────────────────────
    "mount /dev/",
    "umount /",
    "umount -a",

    // ── Crypto-miner patterns ─────────────────────────────────────────────
    "xmrig",
    "minerd",
    "cryptonight",
    "stratum+tcp",
    "stratum+ssl",

    // ── Workspace destruction ──────────────────────────────────────────────
    "rm -rf /workspace",
    "rm -rf /home",

    // ── Observation / side-channel tools ──────────────────────────────────
    "strace ",
    "ltrace ",
    "perf stat",

    // ── PowerShell attack payloads (Windows fallback path) ───────────────
    "invoke-webrequest",
    "invoke-expression",
    "iex(",
    "iex ",
    "downloadstring(",
    "downloadfile(",
    "net.webclient",
    "-encodedcommand",
    "-enc ",
    "convertfrom-base64",
    "system.reflection.assembly"
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

    // Perl -e / Ruby -e with exec-like patterns
    Pattern.compile("(?i)(perl|ruby)\\d*\\s+-e\\s+['\"].*exec.*"),

    // wget/curl piped to bash (download & execute)
    Pattern.compile("(?i)(wget|curl)\\s+.+\\s*\\|\\s*(bash|sh|zsh|fish|python|perl|ruby|node|php)"),

    // wget/curl -O then execute
    Pattern.compile("(?i)(wget|curl)\\s+.+\\s+-[Oo]\\s+.+&&\\s*(bash|sh|chmod|python)"),

    // Base64 decode piped to shell (obfuscated execution)
    Pattern.compile("(?i)base64\\s*(-d|--decode)?\\s*[|>]\\s*(bash|sh|zsh|python|perl|ruby|exec|node)"),

    // Hex/octal decode piped to shell
    Pattern.compile("(?i)(echo|printf)\\s+['\"]?\\\\x[0-9a-fA-F]{2}.*['\"]?\\s*\\|\\s*(bash|sh)"),
    Pattern.compile("(?i)(xxd|od|hexdump).*\\|.*\\b(bash|sh|python|perl)\\b"),

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

    // Glob-based rm of root-level directories
    Pattern.compile("(?i)rm\\s+(-[a-zA-Z]*f[a-zA-Z]*\\s+|--force\\s+)?/[a-z*]+"),

    // chmod +s (SUID) on any file
    Pattern.compile("(?i)chmod\\s+[0-7]*[24][0-7]{0,3}\\s"),
    Pattern.compile("(?i)chmod\\s+[ug]\\+s"),

    // tee to sensitive paths
    Pattern.compile("(?i)\\btee\\b.*/(etc|proc|sys|dev|root|boot)/"),

    // env variable exfiltration: env/printenv | network tool
    Pattern.compile("(?i)(env|printenv|set)\\s*\\|\\s*(nc|curl|wget|socat|python|perl)"),

    // cat sensitive system files
    Pattern.compile("(?i)\\bcat\\b\\s+/etc/(passwd|shadow|sudoers|crontab|hostname|hosts)"),

    // LD_PRELOAD / dynamic linker hijack
    Pattern.compile("(?i)LD_(PRELOAD|LIBRARY_PATH|AUDIT)\\s*="),

    // git clone/fetch from non-local (network) URLs
    Pattern.compile("(?i)git\\s+(clone|fetch|pull|submodule)\\s+(https?://|git://|ssh://|git@)"),

    // npm/pip/gem install from remote in a pipe or exec
    Pattern.compile("(?i)(npm|pip|pip3|gem|cargo)\\s+install\\s+.*(&&|\\|)"),

    // Python http.server / SimpleHTTPServer
    Pattern.compile("(?i)python\\d*\\s+-m\\s+(http\\.server|simplehttpserver)"),

    // PowerShell encoded/download commands
    Pattern.compile("(?i)powershell.*-e(nc|ncodedcommand)?\\s+[A-Za-z0-9+/=]{20,}"),
    Pattern.compile("(?i)(Invoke-Expression|IEX)\\s*\\("),
    Pattern.compile("(?i)Net\\.WebClient.*Download(String|File)\\("),

    // Strace/ltrace on any command
    Pattern.compile("(?i)\\b(strace|ltrace)\\s+"),

    // socat reverse shell patterns
    Pattern.compile("(?i)socat\\s+.*(exec|tcp|udp).*(/bin/|/usr/bin/)"),

    // Attempts to write /etc via tee, redirection or cp
    Pattern.compile("(?i)(>|tee|cp|mv)\\s+/etc/[a-z]"),

    // cron write via tee or echo
    Pattern.compile("(?i)(echo|printf|tee).*/(cron|cron\\.d|cron\\.daily|cron\\.hourly|crontab)"),

    // Excessive redirection attempts (> 3 in one line — unusual)
    Pattern.compile("([|>]{4,})")
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
          "Command blocked by security policy: contains prohibited pattern."
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
