import {
	BufferAttribute,
	BufferGeometry,
	LineBasicMaterial,
	LineSegments,
	Object3D,
	Vector3
} from 'three';

const _v0 = new Vector3();
const _v1 = new Vector3();
const _v2 = new Vector3();

class SpotLightHelper extends Object3D {

	constructor( light, color ) {

		super();

		this.light = light;
		this.matrix = light.matrixWorld;
		this.matrixAutoUpdate = false;

		this.color = color;

		this.type = 'SpotLightHelper';

		const geometry = new BufferGeometry();

		const positions = [
			0, 0, 0, 0, 0, 1,
			0, 0, 0, 1, 0, 1,
			0, 0, 0, - 1, 0, 1,
			0, 0, 0, 0, 1, 1,
			0, 0, 0, 0, - 1, 1
		];

		for ( let i = 0, j = 1, l = 32; i < l; i ++, j ++ ) {

			const p1 = ( i / l ) * Math.PI * 2;
			const p2 = ( j / l ) * Math.PI * 2;

			positions.push(
				Math.cos( p1 ), Math.sin( p1 ), 1,
				Math.cos( p2 ), Math.sin( p2 ), 1
			);

		}

		geometry.setAttribute( 'position', new BufferAttribute( new Float32Array( positions ), 3 ) );

		const material = new LineBasicMaterial( { fog: false, toneMapped: false } );

		this.cone = new LineSegments( geometry, material );
		this.add( this.cone );

		this.update();

	}

	dispose() {

		this.cone.geometry.dispose();
		this.cone.material.dispose();

	}

	update() {

		this.light.updateWorldMatrix( true, false );

		const coneLength = this.light.distance ? this.light.distance : 1000;
		const coneWidth = coneLength * Math.tan( this.light.angle );

		this.cone.scale.set( coneWidth, coneWidth, coneLength );

		_v0.setFromMatrixPosition( this.light.matrixWorld );
		_v1.setFromMatrixPosition( this.light.target.matrixWorld );

		_v2.subVectors( _v1, _v0 );

		this.cone.lookAt( _v2 );

		if ( this.color !== undefined ) {

			this.cone.material.color.set( this.color );

		} else {

			this.cone.material.color.copy( this.light.color );

		}

	}

}


export { SpotLightHelper };