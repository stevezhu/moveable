import { throttle, getDirection, triggerEvent } from "../utils";
import { setDragStart, getDragDist, getResizeDist, getPosByDirection, getSizeInfo, setSizeInfo } from "../DraggerUtils";
import {
    ResizableProps, OnResizeGroup, OnResizeGroupEnd,
    Renderer, OnResizeGroupStart, DraggableProps, OnDragStart, OnDrag, OnResizeStart,
} from "../types";
import MoveableManager from "../MoveableManager";
import { renderAllDirection, renderDiagonalDirection } from "../renderDirection";
import MoveableGroup from "../MoveableGroup";
import {
    triggerChildAble, setCustomEvent, directionCondition, setCustomEventByDelta, setCustomDrag,
} from "../groupUtils";
import Draggable from "./Draggable";
import { getRad, caculate, createRotateMatrix, plus } from "@moveable/matrix";
import { checkSnapSize } from "./Snappable";

export default {
    name: "resizable",
    dragControlOnly: true,
    updateRect: true,
    canPinch: true,

    render(moveable: MoveableManager<Partial<ResizableProps>>, React: Renderer): any[] | undefined {
        const { resizable, edge } = moveable.props;
        if (resizable) {
            if (edge) {
                return renderDiagonalDirection(moveable, React);
            }
            return renderAllDirection(moveable, React);
        }
    },
    dragControlCondition: directionCondition,
    dragControlStart(
        moveable: MoveableManager<ResizableProps & DraggableProps>,
        e: any,
    ) {
        const {
            inputEvent,
            pinchFlag,
            clientX,
            clientY,
            datas,
        } = e;
        const {
            target: inputTarget,
        } = inputEvent;

        const direction = pinchFlag ? [1, 1] : getDirection(inputTarget);
        const { target, width, height } = moveable.state;

        if (!direction || !target) {
            return false;
        }
        !pinchFlag && setDragStart(moveable, { datas });

        datas.datas = {};
        datas.direction = direction;
        datas.offsetWidth = width;
        datas.offsetHeight = height;
        datas.prevWidth = 0;
        datas.prevHeight = 0;
        datas.width = width;
        datas.height = height;
        datas.transformOrigin = moveable.props.transformOrigin;
        setSizeInfo(moveable, datas);

        const params: OnResizeStart = {
            datas: datas.datas,
            target,
            clientX,
            clientY,
            direction,
            set: (startWidth: number, startHeight: number) => {
                datas.width = startWidth;
                datas.height = startHeight;
            },
            setOrigin: (origin: Array<string | number>) => {
                datas.transformOrigin = origin;
            },
            dragStart: Draggable.dragStart(
                moveable,
                setCustomEvent(0, 0, datas, inputEvent),
            ),
        };
        const result = triggerEvent(moveable, "onResizeStart", params);
        if (result !== false) {
            datas.isResize = true;
        }
        return datas.isResize ? params : false;
    },
    dragControl(
        moveable: MoveableManager<ResizableProps & DraggableProps>,
        e: any,
    ) {
        const {
            datas,
            clientX,
            clientY,
            distX, distY,
            pinchFlag, parentDistance, parentScale, inputEvent,
            dragClient,
        } = e;
        const {
            direction,
            width,
            height,
            offsetWidth,
            offsetHeight,
            prevWidth,
            prevHeight,
            isResize,
            transformOrigin,
        } = datas;

        if (!isResize) {
            return;
        }
        const {
            keepRatio,
            throttleResize = 0,
            parentMoveable,
        } = moveable.props;
        const {
            target,
        } = moveable.state;

        // checkSnapSize(moveable as any, e, 1);
        let distWidth: number = 0;
        let distHeight: number = 0;

        // diagonal
        if (parentScale) {
            distWidth = (parentScale[0] - 1) * offsetWidth;
            distHeight = (parentScale[1] - 1) * offsetHeight;

        } else if (pinchFlag) {
            if (parentDistance) {
                distWidth = parentDistance;
                distHeight = parentDistance * offsetHeight / offsetWidth;
            }
        } else {
            const dist = getDragDist({ datas, distX, distY });

            distWidth = direction[0] * dist[0];
            distHeight = direction[1] * dist[1];

            if (
                keepRatio
                && direction[0] && direction[1]
                && offsetWidth && offsetHeight
            ) {
                const size = Math.sqrt(distWidth * distWidth + distHeight * distHeight);
                const rad = getRad([0, 0], dist);
                const standardRad = getRad([0, 0], direction);
                const distDiagonal = Math.cos(rad - standardRad) * size;

                distWidth = distDiagonal;
                distHeight = distDiagonal * offsetHeight / offsetWidth;
            }
        }
        const nextWidth = direction[0]
            ? Math.round(throttle(Math.max(offsetWidth + distWidth, 0), throttleResize!))
            : offsetWidth;
        const nextHeight = direction[1]
            ? Math.round(throttle(Math.max(offsetHeight + distHeight, 0), throttleResize!))
            : offsetHeight;

        distWidth = nextWidth - offsetWidth;
        distHeight = nextHeight - offsetHeight;

        const delta = [distWidth - prevWidth, distHeight - prevHeight];

        datas.prevWidth = distWidth;
        datas.prevHeight = distHeight;

        if (!parentMoveable && delta.every(num => !num)) {
            return;
        }

        const inverseDelta = getResizeDist(
                moveable, datas, nextWidth, nextHeight, direction, transformOrigin, dragClient);

        const params = {
            target: target!,
            width: width + distWidth,
            height: height + distHeight,
            offsetWidth: nextWidth,
            offsetHeight: nextHeight,
            direction,
            dist: [distWidth, distHeight],
            datas: datas.datas,
            delta,
            clientX,
            clientY,
            isPinch: !!pinchFlag,
            drag: Draggable.drag(
                moveable,
                setCustomDrag(moveable, inverseDelta, datas, inputEvent),
            ) as OnDrag,
        };
        triggerEvent(moveable, "onResize", params);
        return params;
    },
    dragControlEnd(moveable: MoveableManager<ResizableProps>, { datas, isDrag, clientX, clientY }: any) {
        if (!datas.isResize) {
            return false;
        }
        datas.isResize = false;

        triggerEvent(moveable, "onResizeEnd", {
            target: moveable.state.target!,
            datas: datas.datas,
            clientX,
            clientY,
            isDrag,
        });
        return isDrag;
    },
    dragGroupControlCondition: directionCondition,
    dragGroupControlStart(moveable: MoveableGroup, e: any) {
        const { datas } = e;
        const params = this.dragControlStart(moveable, e);

        if (!params) {
            return false;
        }
        const direction = params.direction;
        const startPos = getPosByDirection(getSizeInfo(moveable), direction);

        const events = triggerChildAble(
            moveable,
            this,
            "dragControlStart",
            datas,
            (child, childDatas) => {
                const pos = getPosByDirection(getSizeInfo(child), direction);
                const [originalX, originalY] = caculate(
                    createRotateMatrix(-moveable.rotation / 180 * Math.PI, 3),
                    [pos[0] - startPos[0], pos[1] - startPos[1], 1],
                    3,
                );
                childDatas.originalX = originalX;
                childDatas.originalY = originalY;

                return { ...e, parentRotate: 0 };
            },
        );

        const nextParams: OnResizeGroupStart = {
            ...params,
            targets: moveable.props.targets!,
            events,
        };
        const result = triggerEvent(moveable, "onResizeGroupStart", nextParams);

        datas.isResize = result !== false;
        return datas.isResize ? params : false;
    },
    dragGroupControl(moveable: MoveableGroup, e: any) {
        const { datas } = e;
        if (!datas.isResize) {
            return;
        }
        const params = this.dragControl(moveable, e);

        if (!params) {
            return;
        }
        const {
            offsetWidth, offsetHeight, dist,
            direction,
        } = params;

        const parentScale = [
            offsetWidth / (offsetWidth - dist[0]),
            offsetHeight / (offsetHeight - dist[1]),
        ];
        const prevPos = getPosByDirection(getSizeInfo(moveable), direction);

        const events = triggerChildAble(
            moveable,
            this,
            "dragControl",
            datas,
            (_, childDatas) => {
                const [clientX, clientY] = caculate(
                    createRotateMatrix(moveable.rotation / 180 * Math.PI, 3),
                    [
                        childDatas.originalX * parentScale[0],
                        childDatas.originalY * parentScale[1],
                        1,
                    ],
                    3,
                );

                return { ...e, parentScale, dragClient: plus(prevPos, [clientX, clientY]) };
            },
        );
        const nextParams: OnResizeGroup = {
            targets: moveable.props.targets!,
            events,
            ...params,
        };

        triggerEvent(moveable, "onResizeGroup", nextParams);
        return nextParams;
    },
    dragGroupControlEnd(moveable: MoveableGroup, e: any) {
        const { clientX, clientY, isDrag, datas } = e;

        if (!datas.isResize) {
            return;
        }

        this.dragControlEnd(moveable, e);
        triggerChildAble(moveable, this, "dragControlEnd", datas, e);

        const nextParams: OnResizeGroupEnd = {
            targets: moveable.props.targets!,
            clientX,
            clientY,
            isDrag,
            datas: datas.datas,
        };

        triggerEvent(moveable, "onResizeGroupEnd", nextParams);
        return isDrag;
    },
};
