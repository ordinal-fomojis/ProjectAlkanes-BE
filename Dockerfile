FROM node:24
WORKDIR /app
COPY . /app
RUN npm ci
RUN npm run build
EXPOSE 8080
CMD ["npm", "run", "start"]
