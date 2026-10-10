FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY shared ./shared
COPY web ./web
RUN npm install
RUN npm run build --workspace web
FROM nginx:1.27-alpine
COPY web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/web/dist /usr/share/nginx/html
EXPOSE 80
