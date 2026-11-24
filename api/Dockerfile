FROM php:8.3-apache

ENV APACHE_DOCUMENT_ROOT=/var/www/html/public \
    COMPOSER_ALLOW_SUPERUSER=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl git unzip libonig-dev libzip-dev libicu-dev \
    && docker-php-ext-install -j"$(nproc)" pdo_mysql mbstring bcmath intl zip opcache \
    && a2enmod rewrite headers \
    && rm -rf /var/lib/apt/lists/*

COPY --from=composer:2 /usr/bin/composer /usr/local/bin/composer
WORKDIR /var/www/html
COPY . .

RUN composer install --no-dev --no-interaction --prefer-dist --no-progress --optimize-autoloader \
    && mkdir -p storage/framework/cache/data storage/framework/sessions storage/framework/views storage/logs bootstrap/cache \
    && chown -R www-data:www-data storage bootstrap/cache \
    && sed -ri 's!DocumentRoot /var/www/html!DocumentRoot /var/www/html/public!g' /etc/apache2/sites-available/000-default.conf \
    && printf '\n<Directory /var/www/html/public>\n    AllowOverride All\n    Require all granted\n</Directory>\n' >> /etc/apache2/apache2.conf

COPY deploy/render-entrypoint.sh /usr/local/bin/guider-entrypoint
RUN chmod 755 /usr/local/bin/guider-entrypoint

EXPOSE 10000
ENTRYPOINT ["/usr/local/bin/guider-entrypoint"]
