FROM node:22-alpine
WORKDIR /app
COPY server.mjs ./server.mjs
USER node
EXPOSE 7071
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --spider http://127.0.0.1:7071/healthz || exit 1
CMD ["node", "server.mjs"]
