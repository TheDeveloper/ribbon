RUNNER ?= ./node_modules/mocha/bin/mocha
REPORTER ?= list

run = $(RUNNER) -R $(REPORTER) $(1)

test: test-all

test-all:
	$(call run,./test/*)

.PHONY: test test-all test-adaptors
