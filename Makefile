RUNNER ?= ./node_modules/mocha/bin/mocha
REPORTER ?= list

run = $(RUNNER) -R $(REPORTER) $(1)

test: test-all

test-all: test-adaptors

test-adaptors:
	$(call run,./test/adaptors/)

test-adaptor-mysql:
	$(call run,./test/adaptors/adaptor-mysql.js)

test-adaptor-amqp:
	$(call run,./test/adaptors/adaptor-amqp.js)

.PHONY: test test-all test-adaptors
