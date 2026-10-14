# Деплой демосайта из Git через Coolify

Основной источник: `https://github.com/Creepypoke/balance-demo`, ветка `master`.
Coolify собирает корневой `Dockerfile`: Node 24 + pnpm 12.11.2 выполняют
`pnpm install --frozen-lockfile` и `pnpm run build:demo`, затем результат
копируется в непривилегированный nginx. Предварительная локальная сборка и
ручная доставка образа больше не нужны.

- Coolify application: `balance-demo`, UUID `x1tksvflvdhsridiyqikpmyg`.
- Environment: `production` в проекте `balance-demo` (бывший `triangle-demo`).
- Build pack: Dockerfile, путь `/Dockerfile`, build context `/`.
- Внутренний HTTP-порт: `8080`; публикация: `192.168.1.135:8090:8080`.
- Домен Traefik не задаётся: существующий маршрут KeenDNS `balance`
  направляет запросы прямо на LAN-порт; TLS завершается на KeenDNS.
- URL: **https://balance.home-router.crazedns.ru/**, публичный доступ без пароля.
- Лимиты работающего контейнера: 128 MiB RAM, 0,5 CPU; HTTP healthcheck `/`.
- Для обновления: push в `master`, затем **Deploy** в Coolify.
  Автодеплой по push не настроен: панель и webhook endpoint остаются приватными.
- Backup миграции: `/data/coolify/backups/balance-git-20261014/` на `home-server`.
  Старый образ `triangle-demo:demo-20261014-01` сохранён для отката.

Откат: остановить только `balance-demo` средствами Coolify, восстановить
старый Compose из `old-compose.yaml` в этом backup-каталоге как сервис Coolify
на том же порту `8090`. Маршрут роутера менять не нужно.

## Исторический деплой без Git (заменён)

Старый Compose-ресурс удалён после проверки Git-приложения. Примеры ниже
описывают прежнюю схему и не являются текущими инструкциями обновления.

Прежний Dockerfile упаковывал уже собранный `demo-dist/` в непривилегированный nginx
на порту `8080`. Node, Bun и pnpm в работающем контейнере не нужны.
Образ не содержит исходники, зависимости и локальные сертификаты.

## Сборка на локальной машине

Из корня проекта:

```sh
pnpm install --frozen-lockfile
pnpm run build:demo
docker buildx build --platform linux/amd64 --load -t triangle-demo:demo-001 .
```

Для каждого обновления используйте новый тег вместо `demo-001`.
Платформа указана явно: home-server — x86_64, даже если локальная машина ARM.
Если `demo-dist/` отсутствует, Docker-сборка завершится ошибкой; если каталог
устарел, в образ попадёт старая версия, поэтому всегда запускайте `build:demo`.

Локальная проверка:

```sh
docker run --rm -p 127.0.0.1:8090:8080 triangle-demo:demo-001
# В другом терминале:
curl -f http://127.0.0.1:8090/
```

## Доставка и Coolify

После согласования деплоя можно передать образ без registry и Git:

```sh
docker image save triangle-demo:demo-001 | \
  ssh -o BatchMode=yes -o ConnectTimeout=8 home-server 'docker image load'
```

Далее контейнер должен создавать Coolify, а не ручной `docker run` на сервере.
Используйте загруженный локальный образ в Docker Compose-ресурсе:

```yaml
services:
  web:
    image: triangle-demo:demo-001
    pull_policy: never
    environment:
      NGINX_ENTRYPOINT_WORKER_PROCESSES_AUTOTUNE: "1"
    ports:
      - "192.168.1.135:8090:8080"
    restart: unless-stopped
    mem_limit: 64m
    cpus: 0.25
    security_opt:
      - no-new-privileges:true
    cap_drop:
      - ALL
```

Перед деплоем проверьте актуальные LAN IP, свободный порт и поддержку
`pull_policy: never` установленной версией Coolify. Автоматический pull образа
из registry должен быть отключён; образ нужно загрузить именно на сервер
назначения. Домен Traefik для этой схемы не задаётся.

Планируемый внешний маршрут:
`balance.home-router.crazedns.ru` → HTTP `192.168.1.135:8090`.
Маршрут KeenDNS добавляется отдельно, только после согласования и backup
конфигурации роутера. TLS завершается на KeenDNS; nginx принимает HTTP.

Обновление: пересобрать demo и образ с новым тегом, загрузить образ,
изменить тег в Coolify и выполнить redeploy. Для отката вернуть предыдущий
тег в Coolify; предыдущий образ до проверки обновления не удалять.

## Выполненный деплой — 2026-10-14

- Coolify 4.4.6, проект `triangle-demo`: `u9mfodpxbncea88i0d5efdd3`.
- Environment `production`: `44l7j4tc1ugeha4q3wafjn8t`.
- Compose-сервис `triangle-demo`: `buopz9m6d25j0paqwixihotc`.
- Образ `triangle-demo:demo-20261014-01`, linux/amd64.
- Конфигурация: [`../compose.demo.yaml`](../compose.demo.yaml).
- LAN URL: `http://192.168.1.135:8090/`; контейнер healthy.
- HTML, CSS и JS совпали с локальным `demo-dist/` побайтово;
  получение HTML с роутера также проверено.
- Сервис создан штатными моделями и запущен action `StartService` Coolify
  через административный SSH после сверки исходников установленной версии.
- Backup: `/data/coolify/backups/triangle-demo-20261014-01/` на home-server:
  dump БД Coolify до создания, исходный Compose, UUID ресурса и архив образа.
- Откат серверного деплоя: остановить именно этот сервис в Coolify.
  Данных приложения и persistent volumes нет. Откат не выполнялся.
- По отдельному подтверждению создан и сохранён маршрут KeenDNS `balance`:
  `https://balance.home-router.crazedns.ru/` → HTTP `192.168.1.135:8090`.
- Публичный доступ без пароля. Внешний HTTPS проверен с валидацией TLS:
  HTML, CSS и JS совпадают с локальной сборкой; HTTP возвращает 302 на HTTPS.
  Страница также открыта браузером по внешнему URL.
- Backup роутера: `/opt/backups/balance-20261014-01/` (маршруты до/после,
  running-config до изменения и ответ создания маршрута).
- Откат публикации после согласования: на роутере выполнить
  `ndmc -c 'no ip http proxy balance'` и
  `ndmc -c 'system configuration save'`. Остальные маршруты не удалять.
  Откат не выполнялся.
