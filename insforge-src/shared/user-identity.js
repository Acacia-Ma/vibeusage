"use strict";

require("./user-identity-core");

const userIdentityCore = globalThis.__vibeusageUserIdentityCore;
if (!userIdentityCore) throw new Error("user identity core not initialized");

module.exports = userIdentityCore;
