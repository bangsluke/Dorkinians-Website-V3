const tls = require("tls");

function probe(label, extraOptions) {
	return new Promise((resolve) => {
		const opts = {
			host: "registry.npmjs.org",
			port: 443,
			servername: "registry.npmjs.org",
			rejectUnauthorized: true,
			...extraOptions,
		};
		const sock = tls.connect(opts, () => {
			const cert = sock.getPeerCertificate();
			resolve({
				label,
				ok: true,
				authorized: sock.authorized,
				issuer: cert?.issuer?.O || cert?.issuer?.CN || null,
				subject: cert?.subject?.CN || null,
			});
			sock.end();
		});
		sock.on("error", (err) => {
			resolve({
				label,
				ok: false,
				code: err.code,
				message: err.message,
			});
		});
	});
}

(async () => {
	console.log(JSON.stringify(await probe("default", {}), null, 2));
	console.log(JSON.stringify(await probe("useSystemCA", { useSystemCA: true }), null, 2));
})();
