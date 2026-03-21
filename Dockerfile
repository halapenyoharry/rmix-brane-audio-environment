FROM nginx:alpine

# Custom nginx config with COOP/COEP headers for cross-origin isolation
COPY nginx.conf /etc/nginx/conf.d/default.conf

COPY . /usr/share/nginx/html/

EXPOSE 80
