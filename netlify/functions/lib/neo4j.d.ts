export interface Neo4jService {
	connect(): Promise<boolean>;
	disconnect(): Promise<void>;
	getSession(): any | null;
	executeQuery(query: string, params?: Record<string, any>): Promise<any[]>;
	runQuery(query: string, params?: Record<string, any>): Promise<any>;
	createNode(label: string, properties: Record<string, any>): Promise<any>;
	createRelationship(
		fromLabel: string,
		fromProps: Record<string, any>,
		toLabel: string,
		toProps: Record<string, any>,
		relationshipType: string,
		relProps?: Record<string, any>
	): Promise<any>;
	findNode(label: string, properties: Record<string, any>): Promise<any>;
	updateNode(
		label: string,
		matchProps: Record<string, any>,
		updateProps: Record<string, any>
	): Promise<any>;
	deleteNode(label: string, properties: Record<string, any>): Promise<number>;
	clearAllData(): Promise<number>;
	getDataStats(): Promise<{
		totalNodes: number;
		uniqueLabels: number;
		totalRelationships: number;
	}>;
	isConnected(): boolean;
	getGraphLabel(): string;
}

export interface Neo4jServiceInstance {
	driver: any;
	isConnected: boolean;
	GRAPH_LABEL: string;
}

export const neo4jService: Neo4jService;
export const Neo4jService: new () => Neo4jService;
