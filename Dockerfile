FROM node:22-slim

RUN npm install -g @anthropic-ai/claude-code

RUN npm install -g opencode-ai

COPY . /opt/office
WORKDIR /opt/office
RUN npm ci && npm run build && npm install -g .

VOLUME /data/.office
WORKDIR /data
CMD ["tail", "-f", "/dev/null"]
