FROM node:22-slim

RUN npm install -g @anthropic-ai/claude-code

RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates \
    && ARCH=$(dpkg --print-architecture) \
    && curl -fsSL "https://github.com/opencode-ai/opencode/releases/latest/download/opencode_linux_${ARCH}" \
       -o /usr/local/bin/opencode \
    && chmod +x /usr/local/bin/opencode \
    && apt-get purge -y curl && apt-get autoremove -y && rm -rf /var/lib/apt/lists/*

COPY . /opt/office
WORKDIR /opt/office
RUN npm ci && npm run build && npm install -g .

VOLUME /data/.office
WORKDIR /data
CMD ["tail", "-f", "/dev/null"]
