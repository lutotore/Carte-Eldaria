# API : Node seul, sans outil de compilation (SQLite et scrypt sont inclus dans Node).
# Contexte de construction : la racine du dépôt, car l'API réutilise src/domain (règles du monde).

FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /app/api

COPY api/package.json api/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY api/src ./src
COPY src/domain /app/src/domain
# Les fichiers de src/domain sont des modules ES, comme dans le reste du dépôt.
RUN echo '{ "type": "module" }' > /app/package.json

# Jamais en root : l'utilisateur « node » (uid 1000) doit pouvoir écrire dans /donnees.
USER node
EXPOSE 3000
CMD ["node", "--disable-warning=ExperimentalWarning", "src/serveur.js"]
