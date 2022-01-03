// MIT License
//
// Copyright (c) Sindre Sorhus <sindresorhus@gmail.com> (https://sindresorhus.com)
//
// Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

'use strict';
const os = require('os');
// const execa = require('execa');

// Reference: https://www.gaijin.at/en/lstwinver.php
// Windows 11 reference: https://docs.microsoft.com/en-us/windows/release-health/windows11-release-information
const names = new Map([
	['10.0.22', '11'], // It's unclear whether future Windows 11 versions will use this version scheme: https://github.com/sindresorhus/windows-release/pull/26/files#r744945281
	['10.0', '10'],
	['6.3', '8.1'],
	['6.2', '8'],
	['6.1', '7'],
	['6.0', 'Vista'],
	['5.2', 'Server 2003'],
	['5.1', 'XP'],
	['5.0', '2000'],
	['4.90', 'ME'],
	['4.10', '98'],
	['4.03', '95'],
	['4.00', '95'],
]);

const windowsRelease = release => {
	const version = /(\d+\.\d+)(?:\.(\d+))?/.exec(release || os.release());

	if (release && !version) {
		throw new Error('`release` argument doesn\'t match `n.n`');
	}

	let ver = version[1] || '';
	const build = version[2] || '';

	// // Server 2008, 2012, 2016, and 2019 versions are ambiguous with desktop versions and must be detected at runtime.
	// // If `release` is omitted or we're on a Windows system, and the version number is an ambiguous version
	// // then use `wmic` to get the OS caption: https://msdn.microsoft.com/en-us/library/aa394531(v=vs.85).aspx
	// // If `wmic` is obsoloete (later versions of Windows 10), use PowerShell instead.
	// // If the resulting caption contains the year 2008, 2012, 2016 or 2019, it is a server version, so return a server OS name.
	// if ((!release || release === os.release()) && ['6.1', '6.2', '6.3', '10.0'].includes(ver)) {
	// 	let stdout;
	// 	try {
	// 		stdout = execa.sync('powershell', ['(Get-CimInstance -ClassName Win32_OperatingSystem).caption']).stdout || '';
	// 	} catch (_) {
	// 		stdout = execa.sync('wmic', ['os', 'get', 'Caption']).stdout || '';
	// 	}
	//
	// 	const year = (stdout.match(/2008|2012|2016|2019/) || [])[0];
	//
	// 	if (year) {
	// 		return `Server ${year}`;
	// 	}
	// }

	// Windows 11
	if (ver === '10.0' && build.startsWith('22')) {
		ver = '10.0.22';
	}

	return names.get(ver);
};

module.exports = windowsRelease;
