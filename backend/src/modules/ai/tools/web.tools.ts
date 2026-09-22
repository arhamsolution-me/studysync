import { config } from '../../../config';

export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
  score?: number;
}

export interface ImageSearchResult {
  title: string;
  url: string;
  thumbnailUrl?: string;
  source?: string;
}

export const webTools = {
  /**
   * web_search / web_search_fast — query live web for academic info
   */
  async webSearch(query: string, maxResults = 5): Promise<{ success: boolean; results: WebSearchResult[]; error?: string }> {
    try {
      if (config.tavily.apiKey) {
        const res = await fetch('https://api.tavily.com/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            api_key: config.tavily.apiKey,
            query,
            search_depth: 'basic',
            max_results: maxResults,
            include_answer: true,
          }),
        });
        const data = await res.json();
        const results = ((data as any).results || []).map((r: any) => ({
          title: r.title,
          url: r.url,
          snippet: r.content || r.snippet || '',
          score: r.score,
        }));

        return {
          success: true,
          results,
        };
      }

      // Public fallback search via DuckDuckGo Instant Answer / HTML
      const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
      const res = await fetch(ddgUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      });
      const html = await res.text();

      // Extract result links & snippets
      const results: WebSearchResult[] = [];
      const linkRegex = /<a class="result__url" href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a class="result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;
      let match;
      while ((match = linkRegex.exec(html)) !== null && results.length < maxResults) {
        const rawUrl = match[1].trim();
        const url = rawUrl.startsWith('//duckduckgo.com/l/?uddg=')
          ? decodeURIComponent(rawUrl.split('uddg=')[1].split('&')[0])
          : rawUrl;
        results.push({
          title: match[2].replace(/<[^>]+>/g, '').trim(),
          url,
          snippet: match[3].replace(/<[^>]+>/g, '').trim(),
        });
      }

      return {
        success: true,
        results: results.length > 0 ? results : [{ title: `Search for ${query}`, url: `https://www.google.com/search?q=${encodeURIComponent(query)}`, snippet: 'No direct web results parsed.' }],
      };
    } catch (err: any) {
      return { success: false, results: [], error: err.message };
    }
  },

  async webFetch(
    url: string,
    maxLength = 6000
  ): Promise<{
    success: boolean;
    title?: string;
    text?: string;
    videoData?: {
      videoId: string;
      videoTitle: string;
      author: string;
      url: string;
      description: string;
      chapters: Array<{ time: string; seconds: number; label: string }>;
    };
    error?: string;
  }> {
    try {
      // ─── Special High-Fidelity Handler for YouTube URLs ─────────────────────
      const ytMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([a-zA-Z0-9_\-]+)/i);
      if (ytMatch) {
        const videoId = ytMatch[1];
        let videoTitle = '';
        let author = '';
        let description = '';

        // 1. Fetch oembed
        try {
          const oembedRes = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`);
          if (oembedRes.ok) {
            const oembed = await oembedRes.json() as any;
            videoTitle = oembed.title || '';
            author = oembed.author_name || '';
          }
        } catch { /* continue */ }

        // 2. Fetch page HTML to extract full description & player details
        try {
          const pageRes = await fetch(url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept-Language': 'en-US,en;q=0.9',
            },
          });
          if (pageRes.ok) {
            const html = await pageRes.text();
            const playerMatch = html.match(/ytInitialPlayerResponse\s*=\s*({.+?});/);
            if (playerMatch) {
              const playerData = JSON.parse(playerMatch[1]);
              if (!videoTitle && playerData?.videoDetails?.title) {
                videoTitle = playerData.videoDetails.title;
              }
              if (!author && playerData?.videoDetails?.author) {
                author = playerData.videoDetails.author;
              }
              if (playerData?.videoDetails?.shortDescription) {
                description = playerData.videoDetails.shortDescription;
              }
            }
          }
        } catch { /* continue */ }

        // Extract chapters / timestamps from description
        const chapters: Array<{ time: string; seconds: number; label: string }> = [];
        if (description) {
          const timestampRegex = /(?:^|\n)\s*(\d{1,2}:\d{2}(?::\d{2})?)\s+([^\n\r]+)/g;
          let match;
          while ((match = timestampRegex.exec(description)) !== null) {
            const timeStr = match[1];
            const rawLabel = match[2].replace(/^[-–—\s]+|[-–—\s]+$/g, '').trim();
            const parts = timeStr.split(':').map(Number);
            let seconds = 0;
            if (parts.length === 2) {
              seconds = parts[0] * 60 + parts[1];
            } else if (parts.length === 3) {
              seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
            }
            if (rawLabel.length > 2 && rawLabel.length < 80) {
              chapters.push({ time: timeStr, seconds, label: rawLabel });
            }
          }
        }

        const compiledText = [
          `Video Title: ${videoTitle || 'Educational Video'}`,
          author ? `Author / Channel: ${author}` : '',
          `Video URL: ${url}`,
          chapters.length > 0 ? `Interactive Chapters:\n${chapters.map((c) => `- [${c.time}] ${c.label}`).join('\n')}` : '',
          description ? `Video Description & Timestamps:\n${description}` : '',
        ].filter(Boolean).join('\n\n');

        return {
          success: true,
          title: videoTitle ? `${videoTitle} - YouTube` : 'YouTube Video',
          text: compiledText,
          videoData: {
            videoId,
            videoTitle: videoTitle || 'Educational Video',
            author: author || 'YouTube Educator',
            url,
            description: description.substring(0, 500),
            chapters,
          },
        };
      }

      // ─── Standard Web Page Scraping ─────────────────────────────────────────
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) StudySyncBot/1.0',
          'Accept': 'text/html,application/xhtml+xml,text/plain',
        },
      });

      if (!res.ok) {
        return { success: false, error: `HTTP ${res.status}: ${res.statusText}` };
      }

      const html = await res.text();

      // Extract title
      const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      const title = titleMatch ? titleMatch[1].replace(/\s+/g, ' ').trim() : url;

      // Clean HTML: Remove scripts, styles, navs, headers, footers
      let clean = html
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<nav[\s\S]*?<\/nav>/gi, '')
        .replace(/<footer[\s\S]*?<\/footer>/gi, '')
        .replace(/<header[\s\S]*?<\/header>/gi, '')
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/<br\s*[\/]?>/gi, '\n')
        .replace(/<\/p>/gi, '\n\n')
        .replace(/<\/h[1-6]>/gi, '\n\n')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/\s+/g, ' ')
        .trim();

      if (clean.length > maxLength) {
        clean = clean.substring(0, maxLength) + '\n... [Content Truncated]';
      }

      return {
        success: true,
        title,
        text: clean,
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  /**
   * image_search — retrieve relevant academic or illustration images
   */
  async imageSearch(query: string, count = 3): Promise<{ success: boolean; images: ImageSearchResult[]; error?: string }> {
    try {
      if (config.tavily.apiKey) {
        const res = await fetch('https://api.tavily.com/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            api_key: config.tavily.apiKey,
            query: `${query} diagram illustration`,
            include_images: true,
            max_results: count,
          }),
        });
        const data = await res.json();
        const images: ImageSearchResult[] = ((data as any).images || []).map((imgUrl: string, idx: number) => ({
          title: `${query} image ${idx + 1}`,
          url: imgUrl,
          source: 'Tavily Search',
        }));

        if (images.length > 0) {
          return { success: true, images };
        }
      }

      // Unsplash source fallback for high-quality concepts
      const unsplashUrl = `https://source.unsplash.com/featured/?${encodeURIComponent(query)}`;
      return {
        success: true,
        images: [
          {
            title: query,
            url: unsplashUrl,
            source: 'Unsplash',
          },
        ],
      };
    } catch (err: any) {
      return { success: false, images: [], error: err.message };
    }
  },

  /**
   * weather_fetch — get live weather and forecast for any city (via Open-Meteo)
   */
  async weatherFetch(city: string): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      // Step 1: Geocoding
      const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`;
      const geoRes = await fetch(geoUrl, {
        headers: { 'User-Agent': 'StudySyncWeather/1.0' },
      });
      const geoData: any = await geoRes.json();

      if (!geoData.results || geoData.results.length === 0) {
        return {
          success: false,
          error: `Could not find coordinates for city: "${city}". Please check spelling.`,
        };
      }

      const loc = geoData.results[0];
      const { latitude, longitude, name, country } = loc;

      // Step 2: Forecast
      const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto`;
      const weatherRes = await fetch(weatherUrl);
      const wData: any = await weatherRes.json();

      const current = wData.current || {};
      const daily = wData.daily || {};

      // WMO Weather code interpreter
      const weatherDescriptions: Record<number, string> = {
        0: 'Clear sky',
        1: 'Mainly clear',
        2: 'Partly cloudy',
        3: 'Overcast',
        45: 'Fog',
        48: 'Depositing rime fog',
        51: 'Light drizzle',
        53: 'Moderate drizzle',
        55: 'Dense drizzle',
        61: 'Slight rain',
        63: 'Moderate rain',
        65: 'Heavy rain',
        71: 'Slight snow fall',
        73: 'Moderate snow fall',
        75: 'Heavy snow fall',
        80: 'Slight rain showers',
        81: 'Moderate rain showers',
        82: 'Violent rain showers',
        95: 'Thunderstorm',
        96: 'Thunderstorm with slight hail',
        99: 'Thunderstorm with heavy hail',
      };

      const condition = weatherDescriptions[current.weather_code] || 'Fair';

      return {
        success: true,
        data: {
          city: name,
          country: country || '',
          temperatureC: current.temperature_2m,
          feelsLikeC: current.apparent_temperature,
          humidity: current.relative_humidity_2m,
          windSpeedKmh: current.wind_speed_10m,
          precipitationMm: current.precipitation,
          condition,
          highTodayC: daily.temperature_2m_max?.[0],
          lowTodayC: daily.temperature_2m_min?.[0],
        },
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  /**
   * fetch_sports_data — get sports scores, matches, and tournament updates
   */
  async fetchSportsData(query: string): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const searchRes = await this.webSearch(`${query} sports match score result`, 4);
      if (!searchRes.success || searchRes.results.length === 0) {
        return { success: false, error: 'No sports data found for this query.' };
      }

      return {
        success: true,
        data: {
          query,
          topResults: searchRes.results,
        },
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
};
