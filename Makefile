PATH := node_modules/.bin:$(PATH)
SHELL := /bin/bash

.PHONY=all,quality,test


all: quality test ## Run quality checks and tests


quality: quality-py quality-js ## Run code quality checks [py, js]

quality-py:
	@echo Checking python code style...
	python2.7 -m flake8 azure_media_services

quality-js:
	@echo Checking javascript code style...
	node_modules/.bin/eslint azure_media_services/static/js/ ./*.js


test: test-py test-js ## Run unit tests

test-py: ## Run Python tests
	@echo Running python unit tests...
	nosetests azure_media_services.tests.unit --with-coverage --cover-package=azure_media_services

test-js: ## Run JavaScript tests
	@echo Running javascript unit tests...
	karma start karma.conf.js


install-dev: ## Install package using pip to leverage pip's cache and shorten CI build time
	pip install --process-dependency-links -e .

install-test: ## Install dependencies required to run tests
	@echo [re]installing python testing requirements...
	-pip install -Ur requirements_test.txt
	@echo [re]installing javascript testing requirements...
	-npm install

install-tools: ## Install required packages
	@echo installing base tools...
	curl -sL https://deb.nodesource.com/setup_6.x | sudo bash -
	sudo apt-get install nodejs
	node -v
	npm -v


#coverage-unit: ## Send unit tests coverage reports to coverage sevice
#	bash <(curl -s https://codecov.io/bash) -cF unit
#
#coverage-acceptance: ## Send acceptance tests coverage reports to coverage sevice
#	bash <(curl -s https://codecov.io/bash) -cF acceptance

clean: ## Clean working directory
	-rm -rf node_modules/
	-find . -name *.pyc -delete

help:
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)
