# Build from monorepo root: docker build -f wjx-mcp-server/Dockerfile .
FROM node:20-slim AS build
WORKDIR /app

# Copy root package files for workspace resolution
COPY package.json package-lock.json ./
COPY wjx-api-sdk/package.json ./wjx-api-sdk/
COPY wjx-mcp-server/package.json ./wjx-mcp-server/

RUN npm ci --workspaces --ignore-scripts

# Copy source for both packages
COPY wjx-api-sdk/ ./wjx-api-sdk/
COPY wjx-mcp-server/ ./wjx-mcp-server/

RUN npm run build --workspace=wjx-api-sdk && npm run build --workspace=wjx-mcp-server

FROM node:20-slim
WORKDIR /app

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/wjx-api-sdk/dist ./wjx-api-sdk/dist
COPY --from=build /app/wjx-api-sdk/package.json ./wjx-api-sdk/
COPY --from=build /app/wjx-mcp-server/dist ./wjx-mcp-server/dist
COPY --from=build /app/wjx-mcp-server/package.json ./wjx-mcp-server/
COPY --from=build /app/package.json ./

ENV MCP_TRANSPORT=http
ENV PORT=3000
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD node -e "fetch('http://localhost:3000/health').then(r=>{if(!r.ok)throw 1}).catch(()=>process.exit(1))"

CMD ["node", "wjx-mcp-server/dist/index.js", "--http"]
