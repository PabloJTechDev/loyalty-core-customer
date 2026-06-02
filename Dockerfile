FROM node:22-alpine
WORKDIR /app
COPY package.json ./package.json
RUN npm install --omit=dev && npm cache clean --force
COPY src ./src
COPY test ./test
ENV NODE_ENV=production
ENV PORT=3001
EXPOSE 3001
CMD ["npm", "run", "start"]
