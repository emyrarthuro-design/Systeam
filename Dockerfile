FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY index.html tsconfig.json vite.config.ts server.ts ./
COPY src ./src
ARG SYSTEAM_FIREBASE_WEB_CONFIG
ARG SYSTEAM_APP_KIND=systeam
RUN node -e 'const fs = require("node:fs"); const config = JSON.parse(process.env.SYSTEAM_FIREBASE_WEB_CONFIG); if (config.projectId !== "systeam-ruta-cero-staging" || config.firestoreDatabaseId !== "(default)" || !config.appId || !config.apiKey) throw new Error("Invalid Systeam Firebase web configuration"); fs.writeFileSync("firebase-applet-config.json", JSON.stringify(config));' \
    && SYSTEAM_APP_KIND="$SYSTEAM_APP_KIND" npm run build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production SYSTEAM_EXPECTED_FIREBASE_PROJECT=systeam-ruta-cero-staging
ARG SYSTEAM_APP_KIND=systeam
ENV SYSTEAM_APP_KIND=$SYSTEAM_APP_KIND
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY --from=build /app/firebase-applet-config.json ./
USER node
CMD ["node", "dist/server.cjs"]
