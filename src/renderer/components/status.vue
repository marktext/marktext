<template>
  <div
    class="bottom-status"
    :class="{'error': error}"
    v-show="showStatus"
  >
    <div class="status-wrapper">
      <span class="message" :title="message">{{ message }}</span>
      <span class="yes" v-show="showYes" @click="handleYesClick">[ Y ]</span>
      <span class="no" @click="close(true)">[ X ]</span>
    </div>
  </div>
</template>

<script>
  import bus from '../bus'

  export default {
    data () {
      return {
        error: false,
        showStatus: false,
        message: '',
        showYes: false,
        eventId: ''
      }
    },
    created () {
      this.$nextTick(() => {
        bus.$on('status-error', msg => {
          this.showStatus = true
          this.error = true
          this.message = msg
        })
        bus.$on('status-message', (msg, timeout) => {
          this.showStatus = true
          this.error = false
          this.message = msg
          if (timeout) {
            setTimeout(() => {
              this.close(true)
            }, timeout)
          }
        })
        bus.$on('status-promote', (msg, eventId) => {
          this.showStatus = true
          this.error = false
          this.eventId = eventId
          this.showYes = true
          this.message = msg
        })
      })
    },
    methods: {
      close (isEmit = false) {
        const { eventId } = this
        this.error = false
        this.showStatus = false
        this.message = ''
        this.showYes = false
        this.eventId = ''
        if (isEmit && eventId) {
          bus.$emit(eventId, false)
        }
      },
      handleYesClick () {
        const { eventId } = this
        if (eventId) {
          bus.$emit(eventId, true)
        }
        this.close()
      }
    }
  }
</script>

<style scoped>
  .bottom-status {
    width: 100%;
    height: 25px;
    background-color: #2196F3;
    color: #fff;
  }
  .bottom-status.error {
    background-color: var(--dangerColor);
  }
  .status-wrapper {
    text-align: center;
    line-height: 25px;
    font-size: 13px;
    color: #fff;
  }
  .message {
    max-width: 70%;
    display: inline-block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap
  }
  .message, .yes {
    margin-right: 5px;
  }
  .yes, .no {
    vertical-align: top;
    color: #fff;
    cursor: pointer;
  }
</style>
