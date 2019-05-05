<template>
  <div class="pref-sidebar">
    <h3 class="title">Preference</h3>
    <section class="search-wrapper">
      <el-autocomplete
        popper-class="pref-autocomplete"
        v-model="state"
        :fetch-suggestions="querySearch"
        placeholder="Search preference..."
        @select="handleSelect">
        <i
          class="el-icon-search el-input__icon"
          slot="suffix"
        >
        </i>
        <template slot-scope="{ item }">
          <div class="name">{{ item.value }}</div>
          <span class="addr">{{ item.address }}</span>
        </template>
      </el-autocomplete>
    </section>
    <section class="category">
      <div v-for="c of category" :key="c.name" class="item"
        @click="handleCategoryItemClick(c)"
        :class="{active: c.name.toLowerCase() === currentCategory}"
      >
        <svg :viewBox="c.icon.viewBox">
          <use :xlink:href="c.icon.url"></use>
        </svg>
        <span>{{c.name}}</span>
      </div>
    </section>
  </div>
</template>
<script>
import { category } from './config'

export default {
  data() {
    this.category = category
    return {
      currentCategory: 'general',
      restaurants: [],
      state: ''
    }
  },
  watch: {
    '$route' (to, from) {
      if (to.name !== from.name) {
        this.currentCategory = to.name
      }
    }
  },
  methods: {
      querySearch(queryString, cb) {
        var restaurants = this.restaurants;
        var results = queryString ? restaurants.filter(this.createFilter(queryString)) : restaurants
        // 调用 callback 返回建议列表的数据
        cb(results)
      },
      createFilter(queryString) {
        return (restaurant) => {
          return (restaurant.value.toLowerCase().indexOf(queryString.toLowerCase()) === 0)
        }
      },
      loadAll() {
        return [
          { "value": "三全鲜食（北新泾店）", "address": "长宁区新渔路144号" },
          { "value": "Hot honey 首尔炸鸡（仙霞路）", "address": "上海市长宁区淞虹路661号" },
          { "value": "新旺角茶餐厅", "address": "上海市普陀区真北路988号创邑金沙谷6号楼113" },
          { "value": "泷千家(天山西路店)", "address": "天山西路438号" },
          { "value": "胖仙女纸杯蛋糕（上海凌空店）", "address": "上海市长宁区金钟路968号1幢18号楼一层商铺18-101" },
          { "value": "贡茶", "address": "上海市长宁区金钟路633号" }
        ]
      },
      handleSelect(item) {
        console.log(item)
      },
      handleIconClick(ev) {
        console.log(ev)
      },
      handleCategoryItemClick (item) {
        this.$router.push({
          path: item.path
        })
      }
    },
    mounted() {
      this.restaurants = this.loadAll()
    }
}
</script>

<style>
  .pref-sidebar {
    -webkit-app-region: drag;
    background: var(--sideBarBgColor);
    width: 320px;
    height: 100vh;
    padding-top: 40px;
    box-sizing: border-box;
    & h3 {
      margin: 0;
      font-weight: 100;
      text-align: center;
      color: var(--sideBarColor);
    }
  }
  .search-wrapper {
    -webkit-app-region: no-drag;
    padding: 0 20px;
    margin: 30px 0;
  }
  .el-autocomplete {
    width: 280px;
    & .el-input_inner {
      height: 35px;
      line-height: 35px;
    }
  }
  .pref-autocomplete.el-autocomplete-suggestion {
    background: var(--floatBgColor);
    border-color: var(--floatBorderColor);
    & .el-autocomplete-suggestion__wrap li:hover {
      background: var(--floatHoverColor);
    }
    & .popper__arrow {
      display: none;
    }
    & li {
      line-height: normal;
      padding: 7px;
      opacity: .8;

      & .name {
        text-overflow: ellipsis;
        overflow: hidden;
        color: var(--editorColor80);
      }
      & .addr {
        font-size: 12px;
        color: var(--editorColor);
      }

      & .highlighted .addr {
        color: var(--editorColor);
      }
    }
  }
  .category {
    -webkit-app-region: no-drag;
    & .item {
      width: 100%;
      height: 50px;
      font-size: 18px;
      color: var(--sideBarColor);
      padding-left: 20px;
      box-sizing: border-box;
      display: flex;
      flex-direction: row;
      align-items: center;
      cursor: pointer;
      position: relative;
      user-select: none;
      & > svg {
        width: 28px;
        height: 28px;
        fill: var(--iconColor);
        margin-right: 15px;
      }
      &:hover {
        background: var(--sideBarItemHoverBgColor);
      }
      &::before {
        content: '';
        width: 4px;
        height: 0;
        background: var(--themeColor);
        position: absolute;
        left: 0;
        border-top-right-radius: 3px;
        border-bottom-right-radius: 3px;
        transition: height .25s ease-in-out;
        top: 50%;
        transform: translateY(-50%);
      }
      &.active {
        color: var(--sideBarTitleColor);
      }
      &.active::before {
        height: 100%;
      }
    }
  }
</style>
