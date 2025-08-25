const https = require('https');

exports.handler = async (event, context) => {
	const headers = {
		'Access-Control-Allow-Origin': '*',
		'Content-Type': 'application/json'
	};

	try {
		// Test URL from the script
		const testUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSTuGFCG-p_UAnaoatD7rVjSBLPEEXGYawgsAcDZCJgCSPyNvqEgSG-8wRX7bnqZm4YtI0TGiUjdL9a/pub?gid=1796371215&single=true&output=csv";
		
		console.log('🔍 Testing CSV fetch from:', testUrl);
		
		const result = await fetchCSVData(testUrl);
		
		return {
			statusCode: 200,
			headers,
			body: JSON.stringify({
				success: true,
				url: testUrl,
				contentType: result.contentType,
				contentLength: result.data.length,
				sampleData: result.data.substring(0, 500),
				headers: result.responseHeaders
			})
		};
		
	} catch (error) {
		console.error('❌ Test failed:', error);
		
		return {
			statusCode: 500,
			headers,
			body: JSON.stringify({
				success: false,
				error: error.message,
				url: testUrl
			})
		};
	}
};

function fetchCSVData(url) {
	return new Promise((resolve, reject) => {
		const options = {
			headers: {
				'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
				'Accept': 'text/csv,text/plain,*/*',
				'Accept-Language': 'en-US,en;q=0.9',
				'Cache-Control': 'no-cache'
			}
		};
		
		https.get(url, options, (res) => {
			console.log('📊 Response status:', res.statusCode);
			console.log('📊 Response headers:', res.headers);
			
			const contentType = res.headers['content-type'] || '';
			const responseHeaders = res.headers;
			
			let data = '';
			
			res.on('data', (chunk) => {
				data += chunk;
			});
			
			res.on('end', () => {
				console.log('📊 Data received, length:', data.length);
				console.log('📊 First 200 chars:', data.substring(0, 200));
				
				if (data.includes('<html') || data.includes('<HTML')) {
					reject(new Error(`Received HTML instead of CSV. Content: ${data.substring(0, 200)}...`));
					return;
				}
				
				resolve({
					data,
					contentType,
					responseHeaders
				});
			});
		}).on('error', (error) => {
			reject(new Error(`Network error: ${error.message}`));
		});
	});
}
