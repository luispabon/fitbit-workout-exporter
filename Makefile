.PHONY: install run-local build run-docker stop-docker

install:
	npm install

run-local:
	npm run dev

build:
	npm run build

run-docker:
	docker-compose up --build

stop-docker:
	docker-compose down
