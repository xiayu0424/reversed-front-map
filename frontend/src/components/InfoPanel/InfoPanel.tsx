import React, { useEffect } from "react";
import { AttackInfo, City } from "../../types";
import { useUserInteraction } from "../../context/UserInteractionContext";
import { useMapData } from "../../context/MapContext";
import "./InfoPanel.css";
import { calculateAttackRange } from "../../utils/attackRange";
import { CityPanel } from "./CityPanel";
import { NationPanel } from "./NationPanel";
import { UnionPanel } from "./UnionPanel";

interface InfoPanelProps {
    onClose: () => void;
    onUnionClick: (unionId: number) => void;
    onNationClick: (nationId: number) => void;
    onCityJump: (cityId: number) => void;
}

const InfoPanel: React.FC<InfoPanelProps> = ({
                                                 onClose,
                                                 onUnionClick,
                                                 onNationClick,
                                                 onCityJump,
                                             }) => {
    const { paths, cityDetails } = useMapData();
    // Get all selected items from the interaction context
    const { selectedCity, selectedUnion, selectedNation, setAttackableCities } = useUserInteraction();

    const getCityWithDetails = (city: City | null): City | null => {
        if (!city || !cityDetails[city.id]) return city;
        return { ...city, ...cityDetails[city.id] };
    };
    const selectedCityWithDetails = getCityWithDetails(selectedCity);

    useEffect(() => {
        if (selectedCity) {
            // 範圍以遊戲提供的 attack_range_city_ids 為準；遊戲沒有給戰力/跳躍，
            // 這兩個值仍用 pathData 估算，估算不到的城鎮就只標示可攻擊。
            const estimated = calculateAttackRange(selectedCity.id, paths);
            const gameRange = selectedCity.attack_range_city_ids;
            if (gameRange) {
                const range = new Map<number, AttackInfo | null>();
                for (const id of gameRange) {
                    if (id !== selectedCity.id) range.set(id, estimated.get(id) ?? null);
                }
                setAttackableCities(range);
            } else {
                setAttackableCities(estimated);
            }
        }
        return () => {
            setAttackableCities(null);
        };
    }, [selectedCity, paths, setAttackableCities]);

    if (selectedNation) {
        return <NationPanel onUnionClick={onUnionClick} onCityJump={onCityJump} />;
    }
    if (selectedUnion) {
        return <UnionPanel onNationClick={onNationClick} onCityJump={onCityJump} />;
    }
    if (selectedCityWithDetails) {
        return <CityPanel city={selectedCityWithDetails} onUnionClick={onUnionClick} />;
    }
    return null;
};

export default InfoPanel;