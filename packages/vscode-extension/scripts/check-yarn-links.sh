#!/bin/bash

has_yarn_links() {
  ( ls -l node_modules ; ls -l node_modules/@* ) | grep ^l
}


if has_yarn_links ; then
  echo "Error: Found yarn link dependencies. Please remove them before releasing."
  exit 1
else
  echo "No yarn link dependencies found. Proceeding with releasing."
fi
