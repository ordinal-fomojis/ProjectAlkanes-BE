FROM node:24
WORKDIR /app
COPY . /app
RUN npm ci
RUN npm run build
RUN chown -R node:node /app
EXPOSE 8080
USER node
CMD ["npm", "run", "start"]
