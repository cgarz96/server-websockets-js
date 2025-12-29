FROM node:18-alpine

WORKDIR /app

COPY package*.json ./

# Instalamos las dependencias y nodemon de forma global
RUN npm install
RUN npm install -g nodemon

COPY . .

EXPOSE 8080

# Usamos nodemon para ejecutar el script
CMD ["nodemon", "server.js"]