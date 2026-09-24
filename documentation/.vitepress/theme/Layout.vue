<script setup lang="ts">
import DefaultTheme from 'vitepress/theme'

const { Layout } = DefaultTheme
</script>

<template>
  <Layout>
    <template #home-hero-info-after>
      <a
        class="home-hero-badge"
        href="https://m8ven.ai/mcp/im4all/mcp-starter-kit"
        target="_blank"
        rel="noreferrer"
      >
        <img
          src="https://m8ven.ai/badge/mcp/im4all/mcp-starter-kit"
          alt="M8ven Score"
        />
      </a>
    </template>
  </Layout>
</template>
