import { isDOM } from '../util';

function isDOMType(
  value: DOMType | MouseSelectionOptions | undefined,
): value is DOMType {
  return isDOM(value);
}

function isDocument(value: DOMType): value is HTMLDocument {
  return value?.nodeName === '#document';
}

const rectangleElementInlineStyle = 'position: absolute;pointer-events: none;border: 1px solid rgb(45, 140, 240);background: rgba(45, 140, 240, 0.2);';

const getInitCustomRect = () => ({
  left: 0,
  top: 0,
  width: 0,
  height: 0,
  right: 0,
  bottom: 0,
});

class MouseSelection {
  // 矩形框选元素
  public rectangleElement!: HTMLElement;
  public targetDom!: DOMType;
  public domRect: CustomRect | DOMRect = getInitCustomRect();
  public selectionPagePositionRect: CustomRect = getInitCustomRect();
  public selectionDOMPositionRect: CustomRect = getInitCustomRect();
  // 用于标记鼠标点下时的坐标
  private startX: number = 0;
  private startY: number = 0;
  // 当前是否在框选
  private moving: boolean = false;
  // 矩形框选元素类名
  private readonly RectangleElementClassName =
    'frame-selection-rectangle-element';
  // 用于计算滚动DOM，如果targetDom是document，则为document.body
  private wrapDOM: HTMLElement;
  constructor(
    domOrConfig?: DOMType | MouseSelectionOptions,
    public config?: MouseSelectionOptions,
  ) {
    let dom: DOMType = document;
    if (isDOMType(domOrConfig)) {
      dom = domOrConfig;
    }
    this.targetDom = dom;
    if (isDocument(this.targetDom)) {
      this.wrapDOM = document.body;
    } else {
      this.wrapDOM = this.targetDom!;
    }
    this._addMousedownListener(this.targetDom);
  }
  /**
   * @description 获取框选元素以作用DOM为准的偏移和尺寸信息
   * @param left 距离页面左侧距离
   * @param top 距离页面顶部距离
   * @param width 宽度
   * @param height 高度
   */
  public getSelectionPagePosition(
    x: number,
    y: number,
  ): CustomRect {
    const domRect = this.domRect;
    x = x - 2;
    y = y - 2;
    const left = Math.max(domRect.left, Math.min(this.startX, x));
    const top = Math.max(domRect.top, Math.min(this.startY, y));
    const width =
      Math.max(this.startX, Math.min(x, this.wrapDOM!.scrollWidth + domRect.left - 2)) - left;
    const height =
      Math.max(this.startY, Math.min(y, this.wrapDOM!.scrollHeight + domRect.top - 2)) - top;
    return {
      left,
      top,
      width,
      height,
      right: left + width,
      bottom: top + height,
    };
  }
  /**
   * @description 获取矩形框选元素以传入的DOM为准的偏移和尺寸信息
   * @param selectionPagePositionRect getSelectionPagePosition返回的值
   */
  public getSelectionDOMPosition(
    selectionPagePositionRect: CustomRect,
  ): CustomRect {
    const {
      left,
      top,
      width,
      height,
      right,
      bottom,
    } = selectionPagePositionRect;
    const { left: DOMLeft, top: DOMTop } = this.domRect;
    return {
      left: left - DOMLeft,
      top: top - DOMTop,
      width,
      height,
      right: right - DOMLeft,
      bottom: bottom - DOMTop,
    };
  }
  /**
   * @description 工具方法，传入一个包含left/top/width/height字段的对象，返回这个参数描述的矩形是否与框选矩形相交
   * @param positionSizeMap {left,top,width,height} 要判断的
   */
  public isInTheSelection(
    { left, top, width, height }: PositionSizeMap,
  ) {
    const { left: x, top: y, width: w, height: h } = this.selectionDOMPositionRect;
    return left + width > x && x + w > left && top + height > y && y + h > top;
  }
  /**
   * @description 在document.body中创建矩形框选元素
   *              不管事件绑定到哪个DOM，矩形框选元素都添加到document.body
   * @returns 矩形框选元素
   */
  private _createRectangleElement(): HTMLElement {
    let ele = (Array.from(this.wrapDOM!.children) as HTMLElement[]).find(
      (node) => node.className.includes(this.RectangleElementClassName),
    );
    if (ele) {
      this.wrapDOM!.removeChild(ele);
    }
    ele = document.createElement('div') as HTMLElement;
    const customClassName = this.config?.className;
    ele.className =
      this.RectangleElementClassName +
      (customClassName ? ` ${customClassName}` : '');
    ele.style.cssText =
      rectangleElementInlineStyle +
      `z-index: ${this.config?.zIndex || 99999999}`;
    this.wrapDOM!.appendChild(ele);
    return ele;
  }
  /**
   * @description 设置鼠标按下时起始坐标
   * @param x
   * @param y
   */
  private _setStartPosition(x: number, y: number) {
    this.startX = x;
    this.startY = y;
  }
  /**
   * @description 绑定mousedown事件
   * @param dom 要绑定事件的dom
   */
  private _addMousedownListener(dom: DOMType) {
    dom!.addEventListener(
      'mousedown',
      this._selectStart as (event: Event) => void,
    );
  }
  /**
   * @description 获取DOM的Rect信息，如果是document，只返回6个值
   * @param dom 要获取Rect信息的dom
   */
  private _getDOMRect(dom: DOMType): DOMRect | CustomRect {
    const domRect = isDocument(dom)
      ? {
          left: 0,
          top: 0,
          width: window.innerWidth,
          height: window.innerHeight,
          right: window.innerWidth,
          bottom: window.innerHeight,
        }
      : dom!.getBoundingClientRect();
    return domRect;
  }
  /**
   * @description mousedown事件回调
   * @param event 鼠标事件对象
   */
  private _selectStart = (event: MouseEvent) => {
    event.stopPropagation();
    // 如果不是鼠标左键按下不操作
    if (event.button !== 0) {
      return;
    }
    // 如果设置了disabled钩子函数，并且返回值为true，不操作
    if (this.config?.disabled && this.config?.disabled()) {
      return;
    }
    this.rectangleElement = this._createRectangleElement();
    this.moving = true;
    // 设置所作用的DOM的定位及尺寸信息
    this.domRect = this._getDOMRect(this.targetDom);
    // 鼠标点下时距离作用DOM的偏移，需要考虑滚动
    const x = event.pageX + this.wrapDOM!.scrollLeft;
    const y = event.pageY + this.wrapDOM!.scrollTop;
    // 显示矩形框选元素
    this._setRectangleElementStyle('display', 'block');
    // 设置起始点坐标
    this._setStartPosition(x - 2, y - 2);
    // 更新矩形框选元素
    this.selectionPagePositionRect = this.getSelectionPagePosition(
      x,
      y,
    );
    this.selectionDOMPositionRect = this.getSelectionDOMPosition(this.selectionPagePositionRect);
    this._updateRectangleElementStyle(this.selectionDOMPositionRect);
    const callback: ((event: MouseEvent) => void) | undefined = this.config
      ?.onMousedown;
    callback && callback(event);
    document.addEventListener('mouseup', this._selectEnd);
    document.addEventListener('mousemove', this._selecting);
  }
  /**
   * @description mousemove事件回调
   * @param event 鼠标事件对象
   */
  private _selecting = (event: MouseEvent) => {
    if (!this.moving) {
      return;
    }
    // 鼠标当前距离作用DOM的偏移，需要考虑滚动
    const x = event.pageX + this.wrapDOM!.scrollLeft;
    const y = event.pageY + this.wrapDOM!.scrollTop;

    this.selectionPagePositionRect = this.getSelectionPagePosition(
      x,
      y,
    );
    const refitedMouseEvent: RefitedMouseEvent = event;
    this.selectionDOMPositionRect = this.getSelectionDOMPosition(
      this.selectionPagePositionRect,
    );
    refitedMouseEvent.selectionDOMRect = JSON.parse(
      JSON.stringify(this.selectionDOMPositionRect),
    );
    this._updateRectangleElementStyle(this.selectionDOMPositionRect);

    const callback: ((event: RefitedMouseEvent) => void) | undefined = this
      .config?.onMousemove;
    callback && callback(refitedMouseEvent);
  }
  /**
   * @description mouseup事件回调
   * @param event 鼠标事件对象
   */
  private _selectEnd = (event: MouseEvent) => {
    document.removeEventListener('mousemove', this._selecting);
    document.removeEventListener('mouseup', this._selectEnd);
    this._setRectangleElementStyle('display', 'none');
    this.moving = false;
    const callback: ((event: MouseEvent) => void) | undefined = this.config
      ?.onMouseup;
    callback && callback(event);
  }
  /**
   * @description 设置矩形框选元素样式
   * @param props CSS属性名
   * @param value CSS属性值
   */
  private _setRectangleElementStyle(
    this: MouseSelection,
    props: StringTypeNotReadonlyCSSStyleDeclaration,
    value: string,
  ): void {
    this.rectangleElement.style[props] = value;
  }
  /**
   * @description 更新矩形框选元素样式
   * @param currentX 当前鼠标event.pageX值
   * @param currentY 当前鼠标event.pageY值
   */
  private _updateRectangleElementStyle(rect: CustomRect) {
    const { left, top, width, height } = rect;
    this._setRectangleElementStyle('left', `${left}px`);
    this._setRectangleElementStyle('top', `${top}px`);
    this._setRectangleElementStyle('width', `${width}px`);
    this._setRectangleElementStyle('height', `${height}px`);
  }
}

export default MouseSelection;
