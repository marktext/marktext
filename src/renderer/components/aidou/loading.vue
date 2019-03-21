<template>
  <div class="cpt-loading">
    <div class="loader">
      <span v-for="i in 3" :key="i" :style="dotSize"></span>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    size: {
      type: Number,
      default: 14
    }
  },

  computed: {
    dotSize () {
      const size = `${this.size}px`
      return {
        width: size,
        height: size
      }
    }
  }
}
</script>


<style scoped>
  .cpt-loading {
    position: absolute;
    top: 0;
    left: 0;
    display: flex;
    align-items: center;
    width: 100%;
    height: 100%;
  }
  .loader {
    width: 100%;
    text-align: center;
  }

  .loader span {
      position: absolute;
      display: inline-block;
      border-radius: 50%;
      animation: 3s infinite linear;
  }
  .loader span:nth-child(1) {
    background: var(--themeColor);
    animation: kiri 1.2s infinite linear;
  }
  .loader span:nth-child(2) {
    z-index: 100;
    background: var(--highlightColor);
  }
  .loader span:nth-child(3) {
    background: var(--selectionColor);
    animation: kanan 1.2s infinite linear;
  }

  @keyframes kanan {
    0% {
      transform: translateX(20px);
    }

    50% {
      transform: translateX(-20px);
    }

    100% {
      z-index: 200;

      transform: translateX(20px);
    }
  }

  @keyframes kiri {
    0% {
      z-index: 200;

      transform: translateX(-20px);
    }
    50% {
      transform: translateX(20px);
    }
    100% {
      transform: translateX(-20px);
    }
  }
</style>