FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive

# Install only the language runtimes we need.
# curl and git are intentionally excluded:
#   - curl would allow arbitrary code download & execution
#   - git would allow cloning untrusted remote repositories
# wget is excluded for the same reason.
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        python3 \
        python3-pip \
        python3-venv \
        openjdk-21-jdk \
        build-essential \
        ca-certificates \
        ruby-full \
        php-cli \
        golang-go \
        rustc \
        cargo \
        sqlite3 \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

# Install Node.js via the official NodeSource script.
# We pipe via sh here but only to the NodeSource setup script (trusted source).
# This is done at image build time, not at runtime, so there is no user control.
RUN apt-get update && \
    apt-get install -y --no-install-recommends curl && \
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y --no-install-recommends nodejs && \
    npm install -g tsx ts-node typescript && \
    npm --version && \
    node --version && \
    # Remove curl after Node.js setup — it must not be available at runtime
    apt-get remove -y --purge curl && \
    apt-get autoremove -y && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# ──────────────────────────────────────────────────────────────────────────────
# Security stubs: replace dangerous tools with harmless scripts that print a
# clear message and exit non-zero. This ensures that even if these tools were
# somehow installed, they cannot be used.
# ──────────────────────────────────────────────────────────────────────────────
RUN printf '#!/bin/sh\necho "[SyncStream Security] curl is not available in the sandbox." >&2\nexit 1\n' > /usr/local/bin/curl && \
    chmod +x /usr/local/bin/curl

RUN printf '#!/bin/sh\necho "[SyncStream Security] wget is not available in the sandbox." >&2\nexit 1\n' > /usr/local/bin/wget && \
    chmod +x /usr/local/bin/wget

RUN printf '#!/bin/sh\necho "[SyncStream Security] git is not available in the sandbox." >&2\nexit 1\n' > /usr/local/bin/git && \
    chmod +x /usr/local/bin/git

# Create a non-root user for running code.
# The runner user has no sudo access and no home directory privileges.
RUN useradd \
    --create-home \
    --shell /bin/bash \
    --no-user-group \
    runner

# Create workspace and hand it over to the runner user
RUN mkdir -p /workspace && \
    chown -R runner:users /workspace && \
    chmod 750 /workspace

WORKDIR /workspace

# Switch to unprivileged user — all user code runs as 'runner', not root
USER runner

CMD ["sleep", "infinity"]