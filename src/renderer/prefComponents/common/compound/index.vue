<template>
  <section class="pref-compound-item">
    <div class="pref-compound-head">
      <slot name="head"/>
    </div>
    <div class="pref-compound-body">
      <slot name="children"/>
    </div>
    <div v-if="notes" class="notes">
      {{notes}}
    </div>
    </div>
  </section>
</template>

<script>

export default {
  props: {
    notes: String
  }
}
</script>

<style>
  .pref-compound-item {
    font-size: 14px;
    user-select: none;
    margin: 20px 0;
    color: var(--editorColor);
    & .pref-compound-body {
      border: 1pt solid lightgray;
      padding: 8px 16px 8px 16px;
      margin-top: -12px;
      background: rgba(0, 0, 0, .04);
    }
    & .description {
      margin-bottom: 10px;
      & i {
        cursor: pointer;
        opacity: .7;
        color: var(--iconColor);
      }
      & i:hover {
        color: var(--themeColor);
      }
    }
    & .notes {
      margin-top: 10px;
      font-style: italic;
      font-size: 12px;
    }
  }
</style>
