'use client'

import { useState, useRef, useEffect, useCallback, MouseEvent } from "react";
import { Delaunay } from "d3-delaunay";
import { select } from "d3-selection";
import { drag } from "d3-drag";
import "d3-transition";

interface Node {
  id: number;
  x: number;
  y: number;
  color: string;
}

interface Packet {
  currentNode: Node;
  destination: Node;
}

interface RouteEdge {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  startId: number;
  endId: number;
  color: string;
}

interface RouteStats {
  numEdges: number;
  totalLength: number;
  directDistance: number;
}

// Définition des stratégies possibles
type Strategy =
  | "closestToDestination"
  | "angleClosest"
  | "smallestJump"
  | "firstLeft"
  | "random";

const svgWidth = 600;
const svgHeight = 400;
const baseRadius = 5; // rayon de base pour les nœuds

const activeColors = ["red", "blue", "green", "orange"];
const inactiveColor = "grey";
const colors = [inactiveColor, ...activeColors];

interface DraggableCircleProps {
  node: Node;
  onClick: (e: MouseEvent<SVGCircleElement>, node: Node) => void;
  onMouseEnter: (e: MouseEvent<SVGCircleElement>) => void;
  onMouseLeave: (e: MouseEvent<SVGCircleElement>) => void;
  updateNodePosition: (id: number, x: number, y: number) => void;
}

export function DraggableCircle({
  node,
  onClick,
  onMouseEnter,
  onMouseLeave,
  updateNodePosition,
}: DraggableCircleProps) {
  const circleRef = useRef<SVGCircleElement | null>(null);

  useEffect(() => {
    if (!circleRef.current) return;
    const selection = select(circleRef.current);
    selection.call(
      drag<SVGCircleElement, unknown>()
        .on("drag", (event) => {
          updateNodePosition(node.id, event.x, event.y);
        })
    );
  }, [node.id, updateNodePosition]);

  return (
    <circle
      ref={circleRef}
      cx={node.x}
      cy={node.y}
      r={baseRadius}
      fill={node.color}
      onClick={(e) => onClick(e, node)}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    />
  );
}

export default function GraphSimulator() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [packet, setPacket] = useState<Packet | null>(null);
  const [routeEdges, setRouteEdges] = useState<RouteEdge[]>([]);
  const [lastRouteStats, setLastRouteStats] = useState<RouteStats | null>(null);
  const [finalMessage, setFinalMessage] = useState<string | null>(null);

  const [strategy, setStrategy] = useState<Strategy>("closestToDestination");


  // Référence pour s'assurer qu'on démarre la simulation qu'une seule fois par paquet
  const simulationStarted = useRef(false);

  // Ajoute un nœud sur le SVG en cliquant (couleur par défaut = inactive)
  const handleSvgClick = (e: MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const newNode: Node = {
      id: Date.now(),
      x,
      y,
      color: colors[0], // initialement gris
    };
    setNodes([...nodes, newNode]);
  };

  // Au clic sur un nœud, on fait évoluer sa couleur de manière cyclique
  const handleNodeClick = (e: MouseEvent<SVGCircleElement>, node: Node) => {
    e.stopPropagation();
    const currentIndex = colors.indexOf(node.color);
    const nextIndex = (currentIndex + 1) % colors.length;
    setNodes((prevNodes) =>
      prevNodes.map((n) =>
        n.id === node.id ? { ...n, color: colors[nextIndex] } : n
      )
    );
  };

  // Effet de survol avec D3 (agrandissement et bordure)
  const handleMouseEnter = (e: MouseEvent<SVGCircleElement>) => {
    select(e.currentTarget)
      .transition()
      .duration(200)
      .attr("r", baseRadius + 3)
      .attr("stroke", "black")
      .attr("stroke-width", 2);
  };

  const handleMouseLeave = (e: MouseEvent<SVGCircleElement>) => {
    select(e.currentTarget)
      .transition()
      .duration(200)
      .attr("r", baseRadius)
      .attr("stroke", "none")
      .attr("stroke-width", 0);
  };

  // Met à jour la position d'un nœud lors du drag en le contraignant à l'intérieur du SVG
  const updateNodePosition = (id: number, x: number, y: number) => {
    const clampedX = Math.max(baseRadius, Math.min(x, svgWidth - baseRadius));
    const clampedY = Math.max(baseRadius, Math.min(y, svgHeight - baseRadius));
    setNodes((prevNodes) =>
      prevNodes.map((n) =>
        n.id === id ? { ...n, x: clampedX, y: clampedY } : n
      )
    );

    if (routeEdges.some((edge) => edge.startId === id || edge.endId === id)) {
      setRouteEdges([]);
      setLastRouteStats(null);
      setFinalMessage("Le chemin a été réinitialisé en raison d'un déplacement.");
      setPacket(null);
      simulationStarted.current = false;
    }
  };

  // Calcul de la triangulation de Delaunay (pour l'affichage)
  let delaunayPath = "";
  if (nodes.length >= 3) {
    const delaunay = Delaunay.from(nodes.map((n) => [n.x, n.y]));
    delaunayPath = delaunay.render();
  }

  // Fonction utilitaire pour calculer la distance entre deux nœuds
  const distance = (a: Node, b: Node) => {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  };

  // Fonction qui sélectionne le prochain voisin en fonction de la stratégie choisie
  const getNextNode = (current: Node, destination: Node): Node | null => {
    if (nodes.length < 3) return null;

    const delaunay = Delaunay.from(nodes.map((n) => [n.x, n.y]));
    const currentIndex = nodes.findIndex((n) => n.id === current.id);
    const neighborIndices = Array.from(delaunay.neighbors(currentIndex));

    if (neighborIndices.length === 0) return null;

    const candidates = neighborIndices.map((i) => nodes[i]);

    let bestNeighbor: Node | null = null;

    switch (strategy) {
      case "closestToDestination":
        bestNeighbor = candidates.reduce((best, candidate) => {
          const candidateDistance = distance(candidate, destination);
          return best === null || candidateDistance < distance(best, destination)
            ? candidate
            : best;
        }, null as Node | null);
        break;

      case "smallestJump": {
        // On ne considère que les voisins qui rapprochent de la destination
        const validCandidates = candidates.filter(
          candidate => distance(candidate, destination) < distance(current, destination)
        );
        if (validCandidates.length > 0) {
          bestNeighbor = validCandidates.reduce((best, candidate) => {
            const candidateJump = distance(current, candidate);
            return best === null || candidateJump < distance(current, best)
              ? candidate
              : best;
          }, null as Node | null);
        } else {
          bestNeighbor = null;
        }
        break;
      }

      case "angleClosest": {
        const baselineAngle = Math.atan2(
          destination.y - current.y,
          destination.x - current.x
        );
        bestNeighbor = candidates.reduce((best, candidate) => {
          const candidateAngle = Math.atan2(
            candidate.y - current.y,
            candidate.x - current.x
          );
          let diff = Math.abs(candidateAngle - baselineAngle);
          if (diff > Math.PI) diff = 2 * Math.PI - diff;
          if (best === null) return candidate;
          const bestAngle = Math.atan2(
            best.y - current.y,
            best.x - current.x
          );
          let bestDiff = Math.abs(bestAngle - baselineAngle);
          if (bestDiff > Math.PI) bestDiff = 2 * Math.PI - bestDiff;
          return diff < bestDiff ? candidate : best;
        }, null as Node | null);
        break;
      }

      case "firstLeft": {
        const baselineAngle = Math.atan2(
          destination.y - current.y,
          destination.x - current.x
        );
        const candidatesWithAngle = candidates.map((candidate) => {
          const candidateAngle = Math.atan2(
            candidate.y - current.y,
            candidate.x - current.x
          );
          let relativeAngle = candidateAngle - baselineAngle;
          // Normaliser dans l'intervalle [-π, π]
          while (relativeAngle <= -Math.PI) relativeAngle += 2 * Math.PI;
          while (relativeAngle > Math.PI) relativeAngle -= 2 * Math.PI;
          return { candidate, relativeAngle };
        });
        const leftCandidates = candidatesWithAngle.filter(
          (c) => c.relativeAngle > 0
        );
        if (leftCandidates.length > 0) {
          bestNeighbor = leftCandidates.reduce((best, currentItem) =>
            currentItem.relativeAngle < best.relativeAngle
              ? currentItem
              : best
          ).candidate;
        } else {
          bestNeighbor = candidatesWithAngle.reduce((best, currentItem) =>
            currentItem.relativeAngle > best.relativeAngle
              ? currentItem
              : best
          ).candidate;
        }
        break;
      }

      case "random": {
        // On ne sélectionne que les voisins dont l'arête n'a pas encore été empruntée.
        const validCandidates = candidates.filter((candidate) =>
          !routeEdges.some(
            (edge) =>
              (edge.startId === current.id && edge.endId === candidate.id) ||
              (edge.startId === candidate.id && edge.endId === current.id)
          )
        );
        if (validCandidates.length > 0) {
          bestNeighbor = validCandidates[Math.floor(Math.random() * validCandidates.length)];
        } else {
          bestNeighbor = null;
        }
        break;
      }

      default:
        bestNeighbor = candidates.reduce((best, candidate) => {
          const candidateDistance = distance(candidate, destination);
          return best === null || candidateDistance < distance(best, destination)
            ? candidate
            : best;
        }, null as Node | null);
    }
    return bestNeighbor;
  };

  // Fonction récursive qui simule le routage
  const simulateRoutingStep = (current: Node, destination: Node) => {
    const next = getNextNode(current, destination);

    if (!next) {
      setFinalMessage("Paquet perdu : aucun voisin trouvé.");
      setPacket(null);
      simulationStarted.current = false;
      return;
    }


    select("#packet")
      .transition()
      .duration(1000)
      .attr("cx", next.x)
      .attr("cy", next.y)
      .on("end", () => {
        // Ajoute l'arrête une fois le déplacement terminé
        setRouteEdges((prevEdges) => {
          const newEdges = [
            ...prevEdges,
            {
              x1: current.x,
              y1: current.y,
              x2: next.x,
              y2: next.y,
              startId: current.id,
              endId: next.id,
              color: packet!.destination.color,
            },
          ];
          // Si le paquet est arrivé à destination, on calcule les statistiques
          if (next.id === destination.id) {
            const numEdges = newEdges.length;
            const totalLength = newEdges.reduce(
              (sum, edge) =>
                sum + Math.sqrt(Math.pow(edge.x2 - edge.x1, 2) + Math.pow(edge.y2 - edge.y1, 2)),
              0
            );
            const directDistance = Math.sqrt(
              Math.pow(newEdges[0].x1 - newEdges[newEdges.length - 1].x2, 2) +
              Math.pow(newEdges[0].y1 - newEdges[newEdges.length - 1].y2, 2)
            );
            setLastRouteStats({ numEdges, totalLength, directDistance });
          }
          return newEdges;
        });

        if (next.id === destination.id) {
          // On laisse un délai pour que le navigateur rende l'arrête colorée avant d'afficher l'alerte
          setTimeout(() => {
            setFinalMessage("Le paquet est arrivé à destination !");
            setPacket(null);
            simulationStarted.current = false;
          }, 100);
        } else {
          setPacket({ currentNode: next, destination });
          simulateRoutingStep(next, destination);
        }
      });
  };

  // Démarre la simulation de routage
  const startRoutingSimulation = () => {
    setFinalMessage("");

    const activeNodes = nodes.filter((n) => n.color !== inactiveColor);
    if (activeNodes.length < 2) {
      setFinalMessage("Il faut au moins deux nœuds actifs pour démarrer le routage.");
      return;
    }
    const source =
      activeNodes[Math.floor(Math.random() * activeNodes.length)];

    const candidates = activeNodes.filter(
      (n) => n.color === source.color && n.id !== source.id
    );
    if (candidates.length === 0) {
      setFinalMessage("Aucun nœud destination trouvé pour la couleur " + source.color);
      return;
    }
    const destination =
      candidates[Math.floor(Math.random() * candidates.length)];

    // Réinitialise le chemin parcouru
    setRouteEdges([]);
    setLastRouteStats(null);

    // Le paquet hérite de la couleur et des coordonnées du nœud source
    setPacket({ currentNode: source, destination });
    // Réinitialiser le flag de simulation pour cette nouvelle simulation
    simulationStarted.current = false;
  };

  const initialSimulateRoutingStep = useCallback(simulateRoutingStep, [getNextNode, packet, simulateRoutingStep]);
  // useEffect pour démarrer la simulation dès que le paquet est créé
  useEffect(() => {
    if (packet && !simulationStarted.current) {
      simulationStarted.current = true;
      initialSimulateRoutingStep(packet.currentNode, packet.destination);
    }
  }, [packet, initialSimulateRoutingStep]);

  return (
    <>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4">
        <div>
          <label htmlFor="strategy-select" className="mr-2 font-medium">
            Stratégie de routage :
          </label>
          <select
            id="strategy-select"
            value={strategy}
            onChange={(e) => setStrategy(e.target.value as Strategy)}
            className="border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="closestToDestination">
              Le voisin qui rapproche le plus
            </option>
            <option value="angleClosest">
              Le voisin avec l&apos;angle le plus proche
            </option>
            <option value="smallestJump">
              Le voisin qui fait le plus petit saut
            </option>
            <option value="firstLeft">
              Le premier voisin sur la gauche
            </option>
            <option value="random">
              Un voisin au hasard (sans réutiliser une arrête)
            </option>
          </select>
        </div>
        <button
          onClick={startRoutingSimulation}
          className="mt-2 md:mt-0 bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded shadow"
        >
          Démarrer le routage
        </button>
      </div>

      <svg
        onClick={handleSvgClick}
        width={svgWidth}
        height={svgHeight}
        style={{ border: "1px solid black", marginTop: "10px" }}
      >
        {nodes.length >= 3 && (
          <path d={delaunayPath} fill="none" stroke="#ccc" strokeWidth="1" />
        )}
        {routeEdges.map((edge, index) => (
          <line
            key={index}
            x1={edge.x1}
            y1={edge.y1}
            x2={edge.x2}
            y2={edge.y2}
            stroke={edge.color}
            strokeWidth={2} />
        ))}
        {nodes.map((node) => (
          <DraggableCircle
            key={node.id}
            node={node}
            onClick={handleNodeClick}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            updateNodePosition={updateNodePosition} />
        ))}
        {packet && (
          <circle
            id="packet"
            cx={packet.currentNode.x}
            cy={packet.currentNode.y}
            r={baseRadius + 2}
            fill={packet.destination.color} />
        )}
      </svg>

      <div className="mt-6 bg-white border border-gray-200 p-4 rounded shadow">
        {lastRouteStats && (
          <>
            <p className="mb-1">
              <span className="font-medium">Nombre d&apos;arrêtes du chemin :</span> {lastRouteStats.numEdges}
            </p>
            <p className="mb-1">
              <span className="font-medium">Distance totale du chemin :</span> {lastRouteStats.totalLength.toFixed(2)}
            </p>
            <p className="mb-1">
              <span className="font-medium">Distance en direct :</span> {lastRouteStats.directDistance.toFixed(2)}
            </p>
            <p className="mb-1">
              <span className="font-medium">Le chemin est {(lastRouteStats.totalLength / lastRouteStats.directDistance).toFixed(2)} fois plus long que la ligne droite.</span>
            </p>
          </>
        )}
        {finalMessage && (
          <p className="mt-2 text-blue-600 font-semibold">{finalMessage}</p>
        )}
      </div>
    </>
  );
}
