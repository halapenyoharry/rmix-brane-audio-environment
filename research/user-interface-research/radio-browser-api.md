Radio Browser API
This is a completely free, community-curated, and open-source database of over 90,000 internet radio stations globally.

Access: It is a standard REST API. It requires no authentication, no API keys, and has no strict rate limits. They only request that developers use a distinct User-Agent string when making calls so they can track usage.

Search Capabilities: You can query endpoints to filter stations by country, language, exact tags (genres), or global popularity.

Data Payload: The JSON response provides the station name, homepage, codec, bitrate, and the direct stream URL (usually an MP3, AAC, Ogg, or HLS .m3u8 link).

Implementation Logic
Because the API relies on a distributed network of mirrored servers to handle traffic, the standard implementation process is:

DNS Lookup: Execute a DNS lookup for all.api.radio-browser.info to return an array of currently available server nodes.

Select a Node: Randomize the array and select one node (e.g., de1.api.radio-browser.info).

Execute Request: Send a GET request to that specific node.

For example, to return a list of stations tagged with "jazz," you send a GET request to:
https://de1.api.radio-browser.info/json/stations/bytag/jazz

Your system then parses the JSON response, extracts the url_resolved string, and feeds that direct audio link into your local media player or audio daemon.

Commercial Alternatives
Platforms like TuneIn and iHeartRadio have massive directories, but their APIs are closed. Accessing their directory data requires a formal commercial partnership. Platforms like Radio.co have public APIs, but they are built for station operators to manage their own broadcasts, not for retrieving a global directory of third-party streams.

Would you like me to write a short Python or Node.js script that queries the Radio Browser API, parses the response, and outputs the raw audio stream URLs?
