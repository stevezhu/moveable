import MoveableManager from "../MoveableManager";
import { prefix } from "../utils";
import { Renderer } from "../types";
import { createWarpMatrix, convertMatrixtoCSS } from "@moveable/matrix";

export default {
    name: "padding",
    props: {
        padding: Object,
    },
    render(moveable: MoveableManager, React: Renderer): any {
        const padding = moveable.props.padding || {};
        const {
            left = 0,
            top = 0,
            right = 0,
            bottom = 0,
        } = padding;
        const {
            renderPoses,
            pos1,
            pos2,
            pos3,
            pos4,
        } = moveable.state;

        const poses = [pos1, pos2, pos3, pos4];
        const paddingDirections = [];

        if (left > 0) {
            paddingDirections.push([0, 2]);
        }
        if (top > 0) {
            paddingDirections.push([0, 1]);
        }
        if (right > 0) {
            paddingDirections.push([1, 3]);
        }
        if (bottom > 0) {
            paddingDirections.push([2, 3]);
        }
        return paddingDirections.map(([dir1, dir2], i) => {
            const paddingPos1 = poses[dir1];
            const paddingPos2 = poses[dir2];
            const paddingPos3 = renderPoses[dir1];
            const paddingPos4 = renderPoses[dir2];

            const h = createWarpMatrix(
                [0, 0],
                [100, 0],
                [0, 100],
                [100, 100],
                paddingPos1,
                paddingPos2,
                paddingPos3,
                paddingPos4,
            );
            if (!h.length) {
                return undefined;
            }
            return (<div key={`padding${i}`} className={prefix("padding")} style={{
                transform: `matrix3d(${convertMatrixtoCSS(h).join(",")})`,
            }}></div>);
        });
    },
};