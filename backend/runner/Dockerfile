FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && \
    apt-get install -y \
        curl \
        git \
        python3 \
        python3-pip \
        openjdk-21-jdk \
        build-essential \
        ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Node.js + npm
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y nodejs && \
    npm --version && \
    node --version

# Create an unprivileged execution user
RUN useradd \
    --create-home \
    --shell /bin/bash \
    runner

RUN mkdir -p /workspace && \
    chown -R runner:runner /workspace

WORKDIR /workspace

USER runner

CMD ["sleep", "infinity"]