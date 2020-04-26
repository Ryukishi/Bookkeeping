/**
 * @license
 * Copyright CERN and copyright holders of ALICE O2. This software is
 * distributed under the terms of the GNU General Public License v3 (GPL
 * Version 3), copied verbatim in the file "COPYING".
 *
 * See http://alice-o2.web.cern.ch/license for full licensing information.
 *
 * In applying this license CERN does not waive the privileges and immunities
 * granted to it by virtue of its status as an Intergovernmental Organization
 * or submit itself to any jurisdiction.
 */

const { server } = require('./application');

const SHUTDOWN_DELAY_MS = 5 * 1000;

server.listen();

/**
 * Stops the application.
 *
 * @returns {undefined}
 */
const doGracefulShutdown = () => {
    server.close()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
};

/**
 * Starts the graceful shutdown process.
 *
 * @returns {undefined}
 */
const startGracefulShutdown = () => {
    server.acceptIncomingConnections(false);
    setTimeout(doGracefulShutdown, SHUTDOWN_DELAY_MS);
};

/*
 * 'SIGTERM' and 'SIGINT' have default handlers on non-Windows platforms that reset the terminal mode before exiting
 * with code 128 + signal number. If one of these signals has a listener installed, its default behavior will be removed
 * (Node.js will no longer exit).
 */
['SIGTERM', 'SIGINT'].forEach((event) => process.on(event, startGracefulShutdown));