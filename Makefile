.DEFAULT_GOAL := help
.PHONY: help deploy development

help: ## (default), display the list of make commands
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}'

# Helpers

guard-%:
	@ if [ "${${*}}" = "" ]; then \
		echo "Environment variable $* not set"; \
		exit 1; \
	fi

# HTML

build/config.json: src/config.web.js package.json
	@mkdir -p $(dir $@)
	node_modules/.bin/babel-node $< > $@

htmlsrc := $(shell find src/*.html -type f)
htmlbuild := $(patsubst src/%,build/%,$(htmlsrc))
build/%.html: src/%.html src/includes/*.html assets/img/*.svg build/config.json
	@mkdir -p $(dir $@)
ifeq ($(ENVIRONMENT),development)
	node_modules/.bin/babel-node node_modules/.bin/rheactor-build-views build -s assets/img/\*.svg build/config.json $< $@
else
	node_modules/.bin/babel-node node_modules/.bin/rheactor-build-views build -m -s assets/img/\*.svg build/config.json $< $@
endif

# Assets

assetssrcfiles := $(shell find assets/ -type f)
assetsbuildfiles := $(patsubst assets/%,build/%,$(assetssrcfiles))

build/%: assets/%
	@mkdir -p $(dir $@)
	cp $< $@

# Stylesheets

# Build variables for CSS artefacts
csssassed := build/css/styles.css
cssbuild := build/css/styles.min.css

build/css/%.min.css: build/css/%.css
ifeq ($(ENVIRONMENT),development)
	cp $< $@
else
	node_modules/.bin/uglifycss $< > $@
endif

build/css/%.css: src/scss/%.scss src/scss/**/*.scss
	@mkdir -p $(dir $@)
	node_modules/.bin/node-sass $< $@

fonts := $(patsubst node_modules/font-awesome/%,build/%,$(shell find node_modules/font-awesome/fonts/fontawesome-webfont.* -type f))

build/fonts/%: node_modules/font-awesome/fonts/%
	@mkdir -p $(dir $@)
	cp $< $@

# JavaScript

build/js/%.min.js: build/js/%.js
ifeq "${ENVIRONMENT}" "development"
	cp $< $@
else
	./node_modules/.bin/uglifyjs $< -o $@
endif

build/js/%.js: src/js/%.js
	@mkdir -p $(dir $@)
	./node_modules/.bin/browserify $< -o $@ -t [ babelify ]

# DEPLOY

AWS_REGION ?= eu-central-1
AWS_BUCKET ?= lets-work-remote.de
S3_CFG := /tmp/.s3cfg-$(AWS_BUCKET)

deploy: build guard-AWS_SECRET_ACCESS_KEY guard-AWS_ACCESS_KEY ## Deploy to AWS S3
	# Collect dynamic variables
	$(eval VERSION := $(shell node_modules/.bin/babel-node src/config.web.cli.js version))
	$(eval DEPLOY_TIME := $(shell date +%s))

	# Build
	make clean
	ENVIRONMENT=production make -B build
	rm -f $(csssassed)

	# Create s3cmd config
	@echo $(S3_CFG)
	@echo "[default]" > $(S3_CFG)
	@echo "access_key = $(AWS_ACCESS_KEY)" >> $(S3_CFG)
	@echo "secret_key = $(AWS_SECRET_ACCESS_KEY)" >> $(S3_CFG)
	@echo "bucket_location = $(AWS_REGION)" >> $(S3_CFG)

	# Create bucket if not exists
	@if [[ `s3cmd -c $(S3_CFG) ls | grep s3://$(AWS_BUCKET) | wc -l` -eq 1 ]]; then \
		echo "Bucket exists"; \
	else \
		s3cmd -c $(S3_CFG) mb s3://$(AWS_BUCKET); \
		s3cmd -c $(S3_CFG) ws-create s3://$(AWS_BUCKET)/ --ws-index=index.html --ws-error=404.html; \
	fi

	# Upload
	s3cmd -c $(S3_CFG) \
		sync -P -M --no-mime-magic --delete-removed build/ s3://$(AWS_BUCKET)/

	# Expires 10 minutes for html files
	s3cmd -c $(S3_CFG) \
		modify --recursive \
		--add-header=Cache-Control:public,max-age=600 \
		--remove-header=Expires \
		--add-header=x-amz-meta-version:$(VERSION)-$(DEPLOY_TIME) \
		--exclude "*" --include "*.html" --include "*.txt" \
		s3://$(AWS_BUCKET)/

	# Expires 1 year for everything else
	s3cmd -c $(S3_CFG) \
		modify --recursive \
		--add-header=Cache-Control:public,max-age=31536000 \
		--remove-header=Expires \
		--add-header=x-amz-meta-version:$(VERSION)-$(DEPLOY_TIME) \
		--exclude "*.html" --exclude "*.txt" \
		s3://$(AWS_BUCKET)/

# Cleanup

clean:
	rm -rf build

# MAIN

.SECONDARY: $(csssassed) # SO they don't get deleted every run

development: ## Build for development environment
	ENVIRONMENT=development make build

build: $(htmlbuild) $(cssbuild) $(assetsbuildfiles) $(fonts) build/js/main.min.js ## Build for production environment
