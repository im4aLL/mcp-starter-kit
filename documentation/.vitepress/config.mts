import { defineConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "MCP Starter Kit",
  description: "Class-based MCP server starter kit",
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Getting Started', link: '/getting-started' },
      { text: 'Guide', link: '/generating' }
    ],

    search: {
      provider: 'local'
    },

    sidebar: [
      {
        text: 'Start here',
        items: [
          { text: 'Getting Started', link: '/getting-started' },
          { text: 'Generating Capabilities', link: '/generating' }
        ]
      },
      {
        text: 'Build capabilities',
        items: [
          { text: 'Tools', link: '/tools' },
          { text: 'Resources', link: '/resources' },
          { text: 'Prompts', link: '/prompts' },
          { text: 'Services and Injection', link: '/services' }
        ]
      },
      {
        text: 'Run and connect',
        items: [
          { text: 'Running and Integrating', link: '/running' },
          { text: 'Troubleshooting', link: '/troubleshooting' }
        ]
      }
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/im4aLL/mcp-starter-kit' }
    ]
  }
})
