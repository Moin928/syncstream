FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && \
    apt-get install -y \
        curl \
        git \
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
    && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y nodejs && \
    npm install -g tsx ts-node typescript && \
    npm --version && \
    node --version

RUN useradd \
    --create-home \
    --shell /bin/bash \
    runner

RUN mkdir -p /workspace && \
    chown -R runner:runner /workspace

WORKDIR /workspace

USER runner

CMD ["sleep", "infinity"]