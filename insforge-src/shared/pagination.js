"use strict";

require("./pagination-core");

const paginationCore = globalThis.__vibeusagePaginationCore;
if (!paginationCore) throw new Error("pagination core not initialized");

module.exports = { forEachPage: paginationCore.forEachPage };
